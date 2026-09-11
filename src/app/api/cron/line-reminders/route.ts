import { sendLinePushMessage } from '@/lib/line/client';
import { formatTHB } from '@/lib/billing/money';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/utils/date';

/** Days ahead of the event that a tenant is reminded. */
const INVOICE_DUE_DAYS_AHEAD = 3;
const CONTRACT_EXPIRING_DAYS_AHEAD = 30;

/**
 * Daily sweep: reminds tenants (who have linked LINE) of an invoice due
 * soon or a contract expiring soon, each exactly once -- line_reminders_sent
 * is the dedup log. Triggered by Vercel Cron (see vercel.json), same
 * CRON_SECRET bearer-token auth as the overdue-invoice sweep.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('CRON_SECRET is not configured', { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: dueSoon }, { data: expiring }] = await Promise.all([
    admin.rpc('due_soon_invoices_for_line', { p_days_ahead: INVOICE_DUE_DAYS_AHEAD }),
    admin.rpc('expiring_contracts_for_line', { p_days_ahead: CONTRACT_EXPIRING_DAYS_AHEAD }),
  ]);

  let sent = 0;
  const failed: string[] = [];

  for (const invoice of dueSoon ?? []) {
    const text =
      `แจ้งเตือน: ห้อง ${invoice.room_number} มีบิลครบกำหนดชำระวันที่ ` +
      `${formatDate(invoice.due_date, 'th')} ยอด ${formatTHB(invoice.outstanding, 'th')}`;
    const result = await sendLinePushMessage(invoice.line_user_id, text);

    if (result.ok) {
      await admin.from('line_reminders_sent').insert({
        entity_type: 'invoice_due',
        entity_id: invoice.invoice_id,
        tenant_id: invoice.tenant_id,
      });
      sent += 1;
    } else {
      failed.push(`invoice ${invoice.invoice_id}: ${result.error}`);
    }
  }

  for (const contract of expiring ?? []) {
    const text =
      `แจ้งเตือน: สัญญาเช่าห้อง ${contract.room_number} จะสิ้นสุดวันที่ ` +
      `${formatDate(contract.end_date, 'th')} กรุณาติดต่อเจ้าหน้าที่หากต้องการต่อสัญญา`;
    const result = await sendLinePushMessage(contract.line_user_id, text);

    if (result.ok) {
      await admin.from('line_reminders_sent').insert({
        entity_type: 'contract_expiring',
        entity_id: contract.contract_id,
        tenant_id: contract.tenant_id,
      });
      sent += 1;
    } else {
      failed.push(`contract ${contract.contract_id}: ${result.error}`);
    }
  }

  return Response.json({ sent, failed });
}
