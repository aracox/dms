import 'server-only';

import { confirmedPaid, outstanding } from '@/lib/billing/calc';
import { sumMoney } from '@/lib/billing/money';
import { createClient } from '@/lib/supabase/server';
import type { ContractRow } from '@/types/database';

import { pendingDepositSettlement } from './status';

export interface PendingDepositRefund {
  contract: ContractRow;
  roomNumber: string;
  tenantName: string;
  /** Still unpaid across this contract's invoices -- usually deducted from the deposit. */
  outstanding: number;
}

/**
 * Every room whose last tenant moved out without a deposit settlement, oldest
 * move-out first. An operational to-do list, so it reads base tables; the T01
 * test room is excluded.
 */
export async function getPendingDepositRefunds(): Promise<PendingDepositRefund[]> {
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('is_test', false)
    .order('start_date', { ascending: false });

  const byRoom = new Map<string, ContractRow[]>();
  for (const row of contracts ?? []) {
    byRoom.set(row.room_id, [...(byRoom.get(row.room_id) ?? []), row]);
  }
  const pending = [...byRoom.values()]
    .map((roomContracts) => pendingDepositSettlement(roomContracts))
    .filter((row): row is ContractRow => row !== null);

  if (pending.length === 0) return [];

  const contractIds = pending.map((row) => row.id);
  const [rooms, tenants, invoices] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number')
      .in(
        'id',
        pending.map((row) => row.room_id),
      ),
    supabase
      .from('tenants')
      .select('id, full_name')
      .in(
        'id',
        pending.map((row) => row.tenant_id),
      ),
    supabase
      .from('invoices')
      .select('id, contract_id, total')
      .in('contract_id', contractIds)
      .neq('status', 'cancelled'),
  ]);

  const invoiceRows = invoices.data ?? [];
  const { data: payments } = invoiceRows.length
    ? await supabase
        .from('payments')
        .select('invoice_id, amount, status')
        .in(
          'invoice_id',
          invoiceRows.map((invoice) => invoice.id),
        )
    : { data: [] };

  return pending
    .map((contract) => ({
      contract,
      roomNumber: rooms.data?.find((row) => row.id === contract.room_id)?.room_number ?? '',
      tenantName: tenants.data?.find((row) => row.id === contract.tenant_id)?.full_name ?? '',
      outstanding: sumMoney(
        invoiceRows
          .filter((invoice) => invoice.contract_id === contract.id)
          .map((invoice) =>
            outstanding(
              invoice.total,
              confirmedPaid(
                (payments ?? []).filter((payment) => payment.invoice_id === invoice.id),
              ),
            ),
          ),
      ),
    }))
    .sort((a, b) =>
      (a.contract.terminated_at ?? a.contract.end_date).localeCompare(
        b.contract.terminated_at ?? b.contract.end_date,
      ),
    );
}
