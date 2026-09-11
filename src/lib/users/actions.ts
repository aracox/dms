'use server';

import { randomInt } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { createStaffUserSchema, updateStaffUserSchema } from '@/lib/validation/schemas';

// Excludes 0/O/1/l/I so a temporary password read aloud can't be confused.
const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_LENGTH = 12;

function generateTempPassword(): string {
  let password = '';
  for (let i = 0; i < PASSWORD_LENGTH; i += 1) {
    password += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  }
  return password;
}

export interface CreateStaffUserState {
  error: string | null;
  created: { email: string; tempPassword: string } | null;
}

/**
 * Provisions a login for a new staff/admin/owner. auth.admin.createUser needs
 * the service-role client -- there is no user-context way to create another
 * user's account -- so this is one of the few Server Actions that reaches for
 * createAdminClient, gated by the users:manage (owner-only) check below.
 *
 * handle_new_user (migration 0005) always inserts the profiles row at role
 * 'staff'; the follow-up update sets the real role and name, same as
 * scripts/create-user.ts. must_change_password defaults true, so the new
 * user is forced to set their own password at first login.
 */
export async function createStaffUserAction(
  _previous: CreateStaffUserState,
  formData: FormData,
): Promise<CreateStaffUserState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'users:manage');

  const parsed = createStaffUserSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    full_name: String(formData.get('full_name') ?? ''),
    role: String(formData.get('role') ?? ''),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic', created: null };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const alreadyExists = createError?.message.toLowerCase().includes('already been registered');
    return { error: alreadyExists ? 'staff.emailTaken' : 'errors.generic', created: null };
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: parsed.data.role, full_name: parsed.data.full_name })
    .eq('id', created.user.id);
  if (profileError) {
    return { error: 'errors.generic', created: null };
  }

  revalidatePath('/staff');
  return { error: null, created: { email: parsed.data.email, tempPassword } };
}

export interface UpdateStaffUserState {
  error: string | null;
}

/** Changes an existing user's role or active status. Never the acting owner's own row. */
export async function updateStaffUserAction(
  _previous: UpdateStaffUserState,
  formData: FormData,
): Promise<UpdateStaffUserState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'users:manage');

  const parsed = updateStaffUserSchema.safeParse({
    profile_id: String(formData.get('profile_id') ?? ''),
    role: String(formData.get('role') ?? ''),
    is_active: formData.get('is_active') === 'true',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  if (parsed.data.profile_id === profile?.id) {
    return { error: 'staff.cannotEditSelf' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role, is_active: parsed.data.is_active })
    .eq('id', parsed.data.profile_id);
  if (error) return { error: 'errors.generic' };

  revalidatePath('/staff');
  return { error: null };
}
