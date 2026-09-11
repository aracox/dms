import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { replyLineMessage } from '@/lib/line/client';
import type { Database } from '@/types/database';

export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source: { type: string; userId?: string };
  message?: { type: string; text?: string };
}

const WELCOME_MESSAGE =
  'ยินดีต้อนรับ! กรุณาส่งรหัสเชื่อมต่อที่ได้รับจากเจ้าหน้าที่หอพัก เพื่อรับการแจ้งเตือนบิลและสัญญาเช่าทาง LINE';
const CODE_NOT_FOUND_MESSAGE = 'ไม่พบรหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง หรือติดต่อเจ้าหน้าที่หอพัก';

function linkedMessage(fullName: string): string {
  return `เชื่อมต่อสำเร็จ! ระบบจะแจ้งเตือนบิลและสัญญาเช่าให้คุณ ${fullName} ทาง LINE นี้`;
}

/**
 * 'follow': tenant just added the Official Account -- ask for their code.
 * 'message' (text): if it matches an unlinked tenant's line_link_code,
 * link this userId to that tenant and clear the code. Anything else (typo,
 * already-used code, a stranger messaging the bot) gets a generic reply --
 * never anything that could leak which codes are valid.
 */
export async function handleLineEvent(
  admin: SupabaseClient<Database>,
  event: LineWebhookEvent,
): Promise<void> {
  const userId = event.source.userId;
  if (!userId) return;

  if (event.type === 'follow') {
    if (event.replyToken) await replyLineMessage(event.replyToken, WELCOME_MESSAGE);
    return;
  }

  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const code = event.message.text?.trim().toUpperCase();
  if (!code) return;

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, full_name')
    .eq('line_link_code', code)
    .is('line_user_id', null)
    .maybeSingle();

  if (!tenant) {
    if (event.replyToken) await replyLineMessage(event.replyToken, CODE_NOT_FOUND_MESSAGE);
    return;
  }

  await admin
    .from('tenants')
    .update({ line_user_id: userId, line_link_code: null })
    .eq('id', tenant.id);

  if (event.replyToken) {
    await replyLineMessage(event.replyToken, linkedMessage(tenant.full_name));
  }
}
