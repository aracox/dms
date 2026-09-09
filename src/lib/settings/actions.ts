'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { settingsSchema } from '@/lib/validation/schemas';
import type { PropertySegment } from '@/types/database';

import { SEGMENT_SETTING_KEYS, segmentFieldName, type SegmentSettingValues } from './segment-keys';

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
 * Updates every editable setting, for both segments, in one upsert.
 *
 * Since migration 0025 these values live in `segment_settings`, one row per
 * (key, segment), and `settings.value` is frozen for them -- writing there
 * would now raise. Each row that actually changes is logged to
 * segment_settings_history by a DB trigger.
 *
 * Rates and fees already in use (meter readings, invoice items) keep the value
 * they were billed at, so this never rewrites a past month.
 */
export async function updateSettingsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  // Each segment's set is validated on its own, so "electricity rate must be
  // positive" is reported per segment rather than for the pair.
  const bySegment = {} as Record<PropertySegment, SegmentSettingValues>;

  for (const segment of PROPERTY_SEGMENTS) {
    const parsed = settingsSchema.safeParse(
      Object.fromEntries(
        SEGMENT_SETTING_KEYS.map((key) => [
          key,
          Number(formData.get(segmentFieldName(segment, key))),
        ]),
      ),
    );

    if (!parsed.success) {
      return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
    }

    bySegment[segment] = parsed.data;
  }

  const supabase = await createClient();
  const rows = PROPERTY_SEGMENTS.flatMap((segment) =>
    SEGMENT_SETTING_KEYS.map((key) => ({
      key,
      segment,
      value: bySegment[segment][key],
      updated_by: profile.id,
    })),
  );

  const { error } = await supabase
    .from('segment_settings')
    .upsert(rows, { onConflict: 'key,segment' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}
