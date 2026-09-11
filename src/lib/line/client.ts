import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const LINE_API_BASE = 'https://api.line.me/v2/bot/message';

/**
 * Verifies the `x-line-signature` header: base64(HMAC-SHA256(channel
 * secret, raw request body)). Must run against the raw body text, before
 * any JSON.parse, or the signature will never match.
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

async function postLineMessage(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured' };

  const response = await fetch(`${LINE_API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { ok: false, error: `LINE API ${response.status}: ${await response.text()}` };
  }
  return { ok: true };
}

/** Pushes a text message to a linked tenant's real LINE userId. */
export async function sendLinePushMessage(
  userId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  return postLineMessage('push', { to: userId, messages: [{ type: 'text', text }] });
}

/** Replies to an incoming webhook event using its one-time replyToken. */
export async function replyLineMessage(
  replyToken: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  return postLineMessage('reply', { replyToken, messages: [{ type: 'text', text }] });
}
