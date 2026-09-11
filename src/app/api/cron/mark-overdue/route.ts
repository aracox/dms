import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Daily sweep: flips 'issued' invoices past their segment's grace period to
 * 'overdue'. Nothing else calls mark_overdue_invoices() (0025) on a
 * schedule, so without this cron the reporting views still compute overdue
 * live, but a room's own billing tab -- which reads invoices.status
 * directly -- can lag behind reality until some other write happens to
 * retrigger recalc_invoice().
 *
 * Triggered by Vercel Cron (see vercel.json), which sends this bearer
 * token automatically when CRON_SECRET is set on the project. Vercel Hobby
 * plan cron jobs run at most once a day, hence the daily schedule.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('CRON_SECRET is not configured', { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('mark_overdue_invoices');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ markedOverdue: data });
}
