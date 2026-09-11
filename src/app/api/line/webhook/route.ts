import { handleLineEvent, type LineWebhookEvent } from '@/lib/line/webhook';
import { verifyLineSignature } from '@/lib/line/client';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * LINE calls this with no user session -- authenticity comes from the
 * x-line-signature HMAC, verified against the channel secret, never from
 * Supabase auth. Uses the admin client for the same reason: there is no
 * user context to run RLS as.
 */
export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return new Response('LINE_CHANNEL_SECRET is not configured', { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature');

  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { events } = JSON.parse(rawBody) as { events: LineWebhookEvent[] };
  const admin = createAdminClient();

  await Promise.all(events.map((event) => handleLineEvent(admin, event)));

  return new Response('OK', { status: 200 });
}
