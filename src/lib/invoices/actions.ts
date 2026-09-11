'use server';

import { revalidatePath } from 'next/cache';

import { INVOICE_EXTRA_FEE_KEYS, type InvoiceExtraFeeKey } from '@/lib/invoices/fees';
import { generateInvoiceForRoom } from '@/lib/invoices/generate';
import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { currentBillingMonth } from '@/lib/utils/date';
import { generateInvoiceSchema } from '@/lib/validation/schemas';

export interface GenerateInvoiceState {
  error: string | null;
}

/** Thin form wrapper around generateInvoiceForRoom: parse, generate, revalidate. */
export async function generateInvoiceAction(
  _previous: GenerateInvoiceState,
  formData: FormData,
): Promise<GenerateInvoiceState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'invoices:write');

  const parsed = generateInvoiceSchema.safeParse({
    room_id: String(formData.get('room_id') ?? ''),
    billing_month: String(formData.get('billing_month') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const feeKeys: readonly string[] = INVOICE_EXTRA_FEE_KEYS;
  const extraKeys = formData
    .getAll('extra')
    .map(String)
    .filter((key): key is InvoiceExtraFeeKey => feeKeys.includes(key));

  const supabase = await createClient();
  const result = await generateInvoiceForRoom(supabase, {
    roomId: parsed.data.room_id,
    billingMonth: parsed.data.billing_month,
    extraKeys,
  });

  if (!result.error) revalidatePath(`/rooms/${parsed.data.room_id}`);
  return result;
}

export interface BulkGenerateOutcome {
  roomNumber: string;
  error: string;
}

export interface BulkGenerateInvoicesState {
  error: string | null;
  result: {
    createdCount: number;
    /** Room already had a live invoice for the month -- not a failure. */
    skipped: BulkGenerateOutcome[];
    failed: BulkGenerateOutcome[];
  } | null;
}

/**
 * Generates this month's invoice for every active, non-test contract that
 * doesn't already have one, pricing each room's subscribed extras from
 * contract_subscriptions instead of a human re-ticking checkboxes. Every room
 * is independent: one failing (or already invoiced) never blocks the rest.
 */
export async function bulkGenerateInvoicesAction(
  _previous: BulkGenerateInvoicesState,
  _formData: FormData,
): Promise<BulkGenerateInvoicesState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'invoices:write');

  const billingMonth = currentBillingMonth();
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, room_id')
    .eq('status', 'active')
    .eq('is_test', false);

  if (!contracts || contracts.length === 0) {
    return { error: null, result: { createdCount: 0, skipped: [], failed: [] } };
  }

  const roomIds = contracts.map((contract) => contract.room_id);
  const contractIds = contracts.map((contract) => contract.id);

  const [{ data: rooms }, { data: subscriptionRows }] = await Promise.all([
    supabase.from('rooms').select('id, room_number').in('id', roomIds),
    supabase
      .from('contract_subscriptions')
      .select('contract_id, fee_key')
      .in('contract_id', contractIds),
  ]);

  const roomNumberById = new Map((rooms ?? []).map((room) => [room.id, room.room_number]));
  const subscriptionsByContract = new Map<string, InvoiceExtraFeeKey[]>();
  for (const row of subscriptionRows ?? []) {
    const list = subscriptionsByContract.get(row.contract_id) ?? [];
    list.push(row.fee_key as InvoiceExtraFeeKey);
    subscriptionsByContract.set(row.contract_id, list);
  }

  const outcomes = await Promise.all(
    contracts.map(async (contract) => {
      const roomNumber = roomNumberById.get(contract.room_id) ?? contract.room_id;
      const { error } = await generateInvoiceForRoom(supabase, {
        roomId: contract.room_id,
        billingMonth,
        extraKeys: subscriptionsByContract.get(contract.id) ?? [],
      });
      return { roomNumber, error };
    }),
  );

  const skipped = outcomes.filter(
    (outcome): outcome is BulkGenerateOutcome => outcome.error === 'billing.invoiceAlreadyExists',
  );
  const failed = outcomes.filter(
    (outcome): outcome is BulkGenerateOutcome =>
      outcome.error !== null && outcome.error !== 'billing.invoiceAlreadyExists',
  );
  const createdCount = outcomes.length - skipped.length - failed.length;

  revalidatePath('/billing');
  return { error: null, result: { createdCount, skipped, failed } };
}

export interface CancelInvoiceState {
  error: string | null;
}

/**
 * Voids an invoice without destroying it: recalc_invoice pins a cancelled
 * invoice's status regardless of later item/payment changes, and the
 * one-live-invoice-per-month index ignores cancelled rows, so the room can
 * get a fresh invoice for the same month right after.
 */
export async function cancelInvoiceAction(
  _previous: CancelInvoiceState,
  formData: FormData,
): Promise<CancelInvoiceState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'invoices:write');

  const invoiceId = String(formData.get('invoice_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface DeleteInvoiceState {
  error: string | null;
}

/**
 * Permanently removes an invoice (and its items, via cascade). Owner-only,
 * and refused once any payment has been recorded against it -- cancel that
 * invoice instead so the payment history is not silently destroyed.
 */
export async function deleteInvoiceAction(
  _previous: DeleteInvoiceState,
  formData: FormData,
): Promise<DeleteInvoiceState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'invoices:delete');

  const invoiceId = String(formData.get('invoice_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');

  const supabase = await createClient();
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId);

  if (count) return { error: 'billing.invoiceHasPayments' };

  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}
