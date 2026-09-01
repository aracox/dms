'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { settingsSchema } from '@/lib/validation/schemas';

export interface SettingsState {
  message: string | null;
  error: string | null;
}

async function requireOwner() {
  const profile = await getCurrentProfile();
  // Throws PermissionError, which the error boundary renders.
  assertCan(profile?.role, 'settings:write');
  return profile!;
}

/**
 * Updates all editable settings in one upsert. Each row that actually changes
 * value is logged to settings_history by a DB trigger -- see 0010. Rates and
 * fees already in use (meter readings, invoice items) keep the value they were
 * billed at, so this never rewrites a past month.
 */
export async function updateSettingsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  const parsed = settingsSchema.safeParse({
    electricity_rate: Number(formData.get('electricity_rate')),
    water_rate: Number(formData.get('water_rate')),
    internet_fee: Number(formData.get('internet_fee')),
    parking_fee_car: Number(formData.get('parking_fee_car')),
    parking_fee_motorcycle: Number(formData.get('parking_fee_motorcycle')),
    card_replacement_fee: Number(formData.get('card_replacement_fee')),
    default_monthly_rent: Number(formData.get('default_monthly_rent')),
    default_payment_due_day: Number(formData.get('default_payment_due_day')),
    payment_grace_days: Number(formData.get('payment_grace_days')),
  });

  if (!parsed.success) {
    return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const rows = Object.entries(parsed.data).map(([key, value]) => ({
    key,
    value,
    updated_by: profile.id,
  }));

  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}
