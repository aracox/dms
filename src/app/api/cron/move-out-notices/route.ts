import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Daily sweep: auto-terminates any active contract whose planned_move_out_date
 * (from a move-out notice, migration 0031) has arrived, via
 * process_due_move_out_notices() (0032). Same trigger and auth as the
 * overdue-invoice sweep -- see vercel.json and mark-overdue's own comment.
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
  const { data, error } = await supabase.rpc('process_due_move_out_notices');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ movedOut: data });
}
