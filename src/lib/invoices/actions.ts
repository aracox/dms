'use server';

import { revalidatePath } from 'next/cache';

import { buildMonthlyInvoiceItems } from '@/lib/billing/calc';
import {
  EXTRA_FEE_META,
  INVOICE_EXTRA_FEE_KEYS,
  type InvoiceExtraFeeKey,
} from '@/lib/invoices/fees';
import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday, dueDateFor } from '@/lib/utils/date';
import { generateInvoiceSchema } from '@/lib/validation/schemas';

export interface GenerateInvoiceState {
  error: string | null;
}

/**
 * Generates a room's invoice for one billing month: rent from the active
 * contract, that month's recorded electricity/water usage (if any), and
 * whichever extra fees the caller ticked, priced from current settings.
 *
 * One live invoice per room per month is enforced by a DB unique index
 * (invoices_one_live_per_room_month_idx); recalc_invoice then totals the
 * items this inserts.
 */
export async function generateInvoiceAction(
  _previous: GenerateInvoiceState,
  formData: FormData,
): Promise<GenerateInvoiceState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'invoices:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = generateInvoiceSchema.safeParse({
    room_id: roomId,
    billing_month: String(formData.get('billing_month') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const { room_id, billing_month } = parsed.data;

  const feeKeys: readonly string[] = INVOICE_EXTRA_FEE_KEYS;
  const extraKeys = formData
    .getAll('extra')
    .map(String)
    .filter((key): key is InvoiceExtraFeeKey => feeKeys.includes(key));

  const supabase = await createClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, monthly_rent, payment_due_day')
    .eq('room_id', room_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!contract) return { error: 'billing.noActiveContract' };

  const [{ data: readings }, { data: settingsRows }] = await Promise.all([
    supabase
      .from('meter_readings')
      .select('*')
      .eq('room_id', room_id)
      .eq('billing_month', billing_month)
      .in('meter_type', ['electricity', 'water']),
    extraKeys.length
      ? supabase.from('settings').select('key, value').in('key', extraKeys)
      : Promise.resolve({ data: [] }),
  ]);

  const electricityReading = readings?.find((reading) => reading.meter_type === 'electricity');
  const waterReading = readings?.find((reading) => reading.meter_type === 'water');

  const feeValue = (key: string) => {
    const value = settingsRows?.find((row) => row.key === key)?.value;
    return typeof value === 'number' ? value : 0;
  };

  const items = buildMonthlyInvoiceItems({
    monthlyRent: contract.monthly_rent,
    electricity: electricityReading
      ? {
          previousReading: electricityReading.previous_reading,
          currentReading: electricityReading.current_reading,
          rate: electricityReading.rate,
        }
      : undefined,
    water: waterReading
      ? {
          previousReading: waterReading.previous_reading,
          currentReading: waterReading.current_reading,
          rate: waterReading.rate,
        }
      : undefined,
  });

  const dueDate = dueDateFor(billing_month, contract.payment_due_day);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc('next_invoice_number', {
    p_billing_month: billing_month,
  });
  if (numberError || !invoiceNumber) return { error: 'errors.generic' };

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      room_id,
      contract_id: contract.id,
      billing_month,
      invoice_number: invoiceNumber,
      issue_date: bangkokToday(),
      due_date: dueDate,
      status: 'issued',
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    return {
      error: invoiceError?.code === '23505' ? 'billing.invoiceAlreadyExists' : 'errors.generic',
    };
  }

  const itemRows = items.map((item, index) => ({
    invoice_id: invoice.id,
    type: item.type,
    description: '',
    quantity: item.quantity,
    unit_price: item.unitPrice,
    meter_reading_id:
      item.type === 'electricity'
        ? (electricityReading?.id ?? null)
        : item.type === 'water'
          ? (waterReading?.id ?? null)
          : null,
    sort_order: index,
  }));

  extraKeys.forEach((key, index) => {
    const meta = EXTRA_FEE_META[key];
    itemRows.push({
      invoice_id: invoice.id,
      type: meta.type,
      description: meta.description,
      quantity: 1,
      unit_price: feeValue(key),
      meter_reading_id: null,
      sort_order: items.length + index,
    });
  });

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows);
  if (itemsError) return { error: 'errors.generic' };

  revalidatePath(`/rooms/${room_id}`);
  return { error: null };
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
