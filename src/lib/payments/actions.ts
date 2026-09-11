'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { uploadPaymentSlip } from '@/lib/payments/upload';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { paymentSchema } from '@/lib/validation/schemas';
import type { PaymentStatus } from '@/types/database';

export interface RecordPaymentState {
  error: string | null;
}

/**
 * Records a payment against an invoice. Defaults to 'confirmed' (matching
 * the payments table's own default) since staff only enter a payment after
 * verifying the cash or transfer themselves -- 'pending' is there for the
 * rare case they want a second admin to review it first.
 *
 * recalc_invoice() (0005/0025) does the rest: it sums only confirmed
 * payments toward the invoice total and blocks an overpayment.
 */
export async function recordPaymentAction(
  _previous: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'payments:record');

  const roomId = String(formData.get('room_id') ?? '');
  const invoiceId = String(formData.get('invoice_id') ?? '');

  const parsed = paymentSchema.safeParse({
    invoice_id: invoiceId,
    payment_date: String(formData.get('payment_date') ?? ''),
    amount: Number(formData.get('amount')),
    payment_method: String(formData.get('payment_method') ?? ''),
    reference: String(formData.get('reference') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'confirmed'),
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const paymentId = crypto.randomUUID();

  const slipFile = formData.get('slip');
  let slipPath: string | null = null;
  if (slipFile instanceof File && slipFile.size > 0) {
    slipPath = await uploadPaymentSlip(supabase, {
      roomId,
      invoiceId: parsed.data.invoice_id,
      paymentId,
      file: slipFile,
    });
    if (!slipPath) return { error: 'payments.invalidSlipFile' };
  }

  const { error } = await supabase.from('payments').insert({
    id: paymentId,
    ...parsed.data,
    slip_path: slipPath,
    recorded_by: profile!.id,
  });

  if (error) {
    return { error: error.code === '23514' ? 'payments.confirmExceedsTotal' : 'errors.generic' };
  }

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface SetPaymentStatusState {
  error: string | null;
}

/**
 * Confirms or rejects a pending payment. Only transitions a row that is
 * still 'pending' (a stale double-click on an already-processed payment
 * reports errors.generic rather than silently reversing an earlier
 * decision), and refuses against a cancelled invoice -- recalc_invoice
 * keeps a cancelled invoice's own status pinned either way, but confirming
 * money against a bill that no longer stands is not a valid action.
 */
async function setPaymentStatus(
  formData: FormData,
  nextStatus: Extract<PaymentStatus, 'confirmed' | 'cancelled'>,
): Promise<SetPaymentStatusState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'payments:confirm');

  const paymentId = String(formData.get('payment_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');
  const invoiceId = String(formData.get('invoice_id') ?? '');

  const supabase = await createClient();

  if (invoiceId) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invoice?.status === 'cancelled') return { error: 'payments.invoiceCancelled' };
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ status: nextStatus })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    return { error: error.code === '23514' ? 'payments.confirmExceedsTotal' : 'errors.generic' };
  }
  if (!data || data.length === 0) return { error: 'payments.alreadyProcessed' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export async function confirmPaymentAction(
  _previous: SetPaymentStatusState,
  formData: FormData,
): Promise<SetPaymentStatusState> {
  return setPaymentStatus(formData, 'confirmed');
}

export async function rejectPaymentAction(
  _previous: SetPaymentStatusState,
  formData: FormData,
): Promise<SetPaymentStatusState> {
  return setPaymentStatus(formData, 'cancelled');
}
