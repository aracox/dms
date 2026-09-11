import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { PaymentRow } from '@/types/database';

export interface PaymentReceiptData {
  payment: PaymentRow;
  invoiceNumber: string;
  billingMonth: string;
  roomNumber: string;
  /** '' when the contract or tenant can no longer be found (e.g. very old test data). */
  tenantName: string;
}

/**
 * Everything a printable receipt needs for one payment. The tenant comes
 * from the invoice's own contract_id, not the room's current active
 * contract -- a room can turn over to a new tenant after an old payment
 * was recorded, and the receipt must still name whoever actually paid.
 */
export async function getPaymentReceipt(paymentId: string): Promise<PaymentReceiptData | null> {
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) return null;

  const { data: invoice } = await supabase
    .from('invoices')
    .select('invoice_number, billing_month, room_id, contract_id')
    .eq('id', payment.invoice_id)
    .maybeSingle();
  if (!invoice) return null;

  const [{ data: room }, { data: contract }] = await Promise.all([
    supabase.from('rooms').select('room_number').eq('id', invoice.room_id).maybeSingle(),
    invoice.contract_id
      ? supabase.from('contracts').select('tenant_id').eq('id', invoice.contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!room) return null;

  const { data: tenant } = contract?.tenant_id
    ? await supabase.from('tenants').select('full_name').eq('id', contract.tenant_id).maybeSingle()
    : { data: null };

  return {
    payment,
    invoiceNumber: invoice.invoice_number,
    billingMonth: invoice.billing_month,
    roomNumber: room.room_number,
    tenantName: tenant?.full_name ?? '',
  };
}
