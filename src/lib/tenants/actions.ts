'use server';

import { randomInt } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { tenantContactSchema } from '@/lib/validation/schemas';

// Excludes 0/O/1/I so a staff member reading the code aloud can't confuse them.
const LINE_LINK_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LINE_LINK_CODE_LENGTH = 6;
const UNIQUE_VIOLATION = '23505';

function generateLineLinkCode(): string {
  let code = '';
  for (let i = 0; i < LINE_LINK_CODE_LENGTH; i += 1) {
    code += LINE_LINK_CODE_CHARS[randomInt(LINE_LINK_CODE_CHARS.length)];
  }
  return code;
}

export interface UpdateTenantContactState {
  error: string | null;
}

/**
 * Updates only the tenant's contact details (phone, LINE ID, emergency
 * contact/phone) -- the fields that can change during a tenancy. Everything
 * else on the tenant record (name, ID card, nationality) is fixed at move-in.
 */
export async function updateTenantContactAction(
  _previous: UpdateTenantContactState,
  formData: FormData,
): Promise<UpdateTenantContactState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'tenants:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = tenantContactSchema.safeParse({
    tenant_id: String(formData.get('tenant_id') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    line_id: String(formData.get('line_id') ?? '').trim() || null,
    emergency_contact: String(formData.get('emergency_contact') ?? '').trim() || null,
    emergency_phone: String(formData.get('emergency_phone') ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({
      phone: parsed.data.phone,
      line_id: parsed.data.line_id ?? null,
      emergency_contact: parsed.data.emergency_contact ?? null,
      emergency_phone: parsed.data.emergency_phone || null,
    })
    .eq('id', parsed.data.tenant_id);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface GenerateLineLinkCodeState {
  error: string | null;
  code: string | null;
}

/**
 * Generates a one-time code staff relay to the tenant to send to the LINE
 * Official Account, which the webhook (src/lib/line/webhook.ts) matches to
 * capture the tenant's real LINE userId. Retries on a code collision against
 * the partial unique index; refuses to overwrite an already-linked tenant.
 */
export async function generateLineLinkCodeAction(
  _previous: GenerateLineLinkCodeState,
  formData: FormData,
): Promise<GenerateLineLinkCodeState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'tenants:write');

  const tenantId = String(formData.get('tenant_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');
  if (!tenantId) return { error: 'errors.generic', code: null };

  const supabase = await createClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateLineLinkCode();
    const { data, error } = await supabase
      .from('tenants')
      .update({ line_link_code: code })
      .eq('id', tenantId)
      .is('line_user_id', null)
      .select('line_link_code')
      .single();

    if (!error) {
      if (roomId) revalidatePath(`/rooms/${roomId}`);
      return { error: null, code: data.line_link_code };
    }
    if (error.code !== UNIQUE_VIOLATION) return { error: 'errors.generic', code: null };
  }

  return { error: 'errors.generic', code: null };
}

export interface UnlinkLineState {
  error: string | null;
}

/**
 * Detaches the tenant's LINE account (and any pending link code) so a new one
 * can be linked -- e.g. the tenant changed LINE accounts, or the wrong one was
 * linked. Reminders stop until a new code is redeemed.
 */
export async function unlinkLineAction(
  _previous: UnlinkLineState,
  formData: FormData,
): Promise<UnlinkLineState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'tenants:write');

  const tenantId = String(formData.get('tenant_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');
  if (!tenantId) return { error: 'errors.generic' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ line_user_id: null, line_link_code: null })
    .eq('id', tenantId);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}
