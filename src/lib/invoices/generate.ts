import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildMonthlyInvoiceItems } from '@/lib/billing/calc';
import { EXTRA_FEE_META, type InvoiceExtraFeeKey } from '@/lib/invoices/fees';
import { propertySegment } from '@/lib/reporting/segments';
import { bangkokToday, dueDateFor, type IsoDate } from '@/lib/utils/date';
import type { Database } from '@/types/database';

export interface GenerateInvoiceResult {
  error: string | null;
}

/**
 * Generates a room's invoice for one billing month: rent from the active
 * contract, that month's recorded electricity/water usage (if any -- a room
 * with no reading yet simply gets rent and extras, no utility line), and
 * whichever extra fees the caller passed, priced from current settings.
 *
 * Shared by the single-room form action and bulk generation, so both go
 * through the exact same rules and error codes.
 *
 * One live invoice per room per month is enforced by a DB unique index
 * (invoices_one_live_per_room_month_idx); recalc_invoice then totals the
 * items this inserts.
 */
export async function generateInvoiceForRoom(
  supabase: SupabaseClient<Database>,
  {
    roomId,
    billingMonth,
    extraKeys,
  }: { roomId: string; billingMonth: IsoDate; extraKeys: readonly InvoiceExtraFeeKey[] },
): Promise<GenerateInvoiceResult> {
  const [{ data: contract }, { data: room }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, monthly_rent, payment_due_day')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle(),
    // The room's type decides which segment's fees apply -- a house is priced
    // from the บ้านพัก column, not the building-wide one that no longer exists.
    supabase.from('rooms').select('room_type').eq('id', roomId).maybeSingle(),
  ]);

  if (!contract) return { error: 'billing.noActiveContract' };
  if (!room) return { error: 'errors.generic' };

  const segment = propertySegment(room.room_type);

  const [{ data: readings }, { data: settingsRows }] = await Promise.all([
    supabase
      .from('meter_readings')
      .select('*')
      .eq('room_id', roomId)
      .eq('billing_month', billingMonth)
      .in('meter_type', ['electricity', 'water']),
    extraKeys.length
      ? supabase
          .from('segment_settings')
          .select('key, value')
          .eq('segment', segment)
          .in('key', extraKeys)
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

  const dueDate = dueDateFor(billingMonth, contract.payment_due_day);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc('next_invoice_number', {
    p_billing_month: billingMonth,
  });
  if (numberError || !invoiceNumber) return { error: 'errors.generic' };

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      room_id: roomId,
      contract_id: contract.id,
      billing_month: billingMonth,
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

  return { error: null };
}
