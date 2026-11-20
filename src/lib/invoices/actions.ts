'use server';

import { revalidatePath } from 'next/cache';

import { INVOICE_EXTRA_FEE_KEYS, type InvoiceExtraFeeKey } from '@/lib/invoices/fees';
import { generateInvoicesForRoom } from '@/lib/invoices/generate';
import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { currentBillingMonth } from '@/lib/utils/date';
import { generateInvoiceSchema } from '@/lib/validation/schemas';

export interface GenerateInvoiceState {
  error: string | null;
}

/**
 * Thin form wrapper around generateInvoicesForRoom: parse, generate,
 * revalidate. Creates the room's missing bills for the month -- usually one,
 * two in a turnover month -- with the ticked extras on the bill of the tenant
 * in the room at month end.
 */
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
  const result = await generateInvoicesForRoom(supabase, {
    roomId: parsed.data.room_id,
    billingMonth: parsed.data.billing_month,
    extras: extraKeys,
  });

  // A partial run (one bill of two created) still changed the room.
  if (result.created > 0) revalidatePath(`/rooms/${parsed.data.room_id}`);
  return { error: result.error };
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
 * Generates this month's bills for every room with an active, non-test
 * contract, creating whatever each room is missing -- including the outgoing
 * tenant's part-month bill in a turnover month -- and pricing each contract's
 * extras from its contract_subscriptions instead of a human re-ticking
 * checkboxes. Every room is independent: one failing (or already billed)
 * never blocks the rest.
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
    .select('room_id')
    .eq('status', 'active')
    .eq('is_test', false);

  const roomIds = [...new Set((contracts ?? []).map((contract) => contract.room_id))];
  if (roomIds.length === 0) {
    return { error: null, result: { createdCount: 0, skipped: [], failed: [] } };
  }

  const { data: rooms } = await supabase.from('rooms').select('id, room_number').in('id', roomIds);
  const roomNumberById = new Map((rooms ?? []).map((room) => [room.id, room.room_number]));

  const outcomes = await Promise.all(
    roomIds.map(async (roomId) => {
      const roomNumber = roomNumberById.get(roomId) ?? roomId;
      const { error, created } = await generateInvoicesForRoom(supabase, {
        roomId,
        billingMonth,
        extras: 'subscriptions',
      });
      return { roomNumber, error, created };
    }),
  );

  const skipped = outcomes
    .filter((outcome) => outcome.error === 'billing.invoiceAlreadyExists')
    .map(({ roomNumber, error }) => ({ roomNumber, error: error! }));
  const failed = outcomes
    .filter((outcome) => outcome.error !== null && outcome.error !== 'billing.invoiceAlreadyExists')
    .map(({ roomNumber, error }) => ({ roomNumber, error: error! }));
  const createdCount = outcomes.reduce((sum, outcome) => sum + outcome.created, 0);

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

  // Voiding a bill with confirmed money on it orphans that payment, and the
  // reissued bill would charge the tenant a second time.
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId)
    .eq('status', 'confirmed');

  if (count) return { error: 'billing.cancelHasPayments' };

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
