import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { billingMonthOf } from '@/lib/utils/date';
import type { Database } from '@/types/database';

import { loadRoomMonth } from './generate';

export interface RefreshBillsResult {
  error: string | null;
  /** Bills re-priced. */
  updated: number;
  /** Bills cancelled: they were for months after the tenant left. */
  cancelled: number;
  /**
   * Bills left as they were because more is already paid on them than they
   * now come to -- the owner settles the difference with the tenant.
   */
  needsReview: string[];
}

/**
 * Brings a moved-out contract's bills in line with its move-out: the bill for
 * the month it ended is re-priced -- rent for the days actually stayed, and
 * the final meter usage -- through the same rules as a new bill
 * (loadRoomMonth). A bill for a later month, which the contract no longer
 * covers, is cancelled.
 *
 * Run after a manual move-out, after the daily notice sweep moves a tenant
 * out, and after final meter numbers are recorded later. Idempotent: a bill
 * that already matches is rewritten with the same lines. Only rent and meter
 * lines change (replace_invoice_charges, 0048); fees stay as they were.
 */
export async function refreshContractBills(
  supabase: SupabaseClient<Database>,
  contractId: string,
): Promise<RefreshBillsResult> {
  const result: RefreshBillsResult = { error: null, updated: 0, cancelled: 0, needsReview: [] };

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, room_id, terminated_at')
    .eq('id', contractId)
    .maybeSingle();
  if (!contract?.terminated_at) return { ...result, error: 'errors.generic' };

  const { data: bills, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, billing_month')
    .eq('contract_id', contractId)
    .neq('status', 'cancelled')
    .gte('billing_month', billingMonthOf(contract.terminated_at))
    .order('billing_month');
  if (error) return { ...result, error: 'errors.generic' };

  for (const bill of bills ?? []) {
    const month = await loadRoomMonth(supabase, contract.room_id, bill.billing_month, {
      excludeInvoiceId: bill.id,
    });
    if (!month) return { ...result, error: 'errors.generic' };

    const covered = month.monthContracts.find((candidate) => candidate.id === contractId);

    if (!covered) {
      // Cancelling a bill with money on it would orphan the payment.
      const { count } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', bill.id)
        .eq('status', 'confirmed');
      if (count) {
        result.needsReview.push(bill.invoice_number);
        continue;
      }
      const { error: cancelError } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', bill.id);
      if (cancelError) return { ...result, error: 'errors.generic' };
      result.cancelled += 1;
      continue;
    }

    const { error: replaceError } = await supabase.rpc('replace_invoice_charges', {
      p_invoice_id: bill.id,
      p_items: month.charges(covered),
    });
    if (replaceError) {
      // check_violation: payments already exceed the new total.
      if (replaceError.code === '23514') {
        result.needsReview.push(bill.invoice_number);
        continue;
      }
      return { ...result, error: 'errors.generic' };
    }
    result.updated += 1;
  }

  return result;
}
