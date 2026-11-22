import { refreshContractBills } from '@/lib/invoices/refresh';
import { createAdminClient } from '@/lib/supabase/admin';
import { bangkokToday } from '@/lib/utils/date';

/**
 * Daily sweep: auto-terminates any active contract whose planned_move_out_date
 * (from a move-out notice, migration 0031) has arrived, via
 * process_due_move_out_notices() (0032). Same trigger and auth as the
 * overdue-invoice sweep -- see vercel.json and mark-overdue's own comment.
 * Then re-prices each moved-out tenant's bills (refreshContractBills).
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

  // The same contracts the sweep is about to move out, so their bills can be
  // re-priced afterwards: a bill issued before the notice date charged the
  // whole month.
  const { data: due, error: dueError } = await supabase
    .from('contracts')
    .select('id')
    .eq('status', 'active')
    .not('notice_given_at', 'is', null)
    .lte('planned_move_out_date', bangkokToday());
  if (dueError) {
    return Response.json({ error: dueError.message }, { status: 500 });
  }

  const { data, error } = await supabase.rpc('process_due_move_out_notices');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const needsReview: string[] = [];
  for (const contract of due ?? []) {
    const refreshed = await refreshContractBills(supabase, contract.id);
    needsReview.push(...refreshed.needsReview);
  }

  return Response.json({ movedOut: data, needsReview });
}
