'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { tenantContactSchema } from '@/lib/validation/schemas';

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
