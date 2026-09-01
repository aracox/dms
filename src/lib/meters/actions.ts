'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { meterReadingSchema } from '@/lib/validation/schemas';

export interface RecordMeterReadingState {
  error: string | null;
}

/**
 * Records a room's electricity/water reading for a billing month. Recording a
 * new month is staff-level; correcting a month that already has a reading
 * requires admin, matching meter_readings' RLS (insert: staff+, update: admin+).
 */
export async function recordMeterReadingAction(
  _previous: RecordMeterReadingState,
  formData: FormData,
): Promise<RecordMeterReadingState> {
  const profile = await getCurrentProfile();
  const roomId = String(formData.get('room_id') ?? '');

  const parsed = meterReadingSchema.safeParse({
    room_id: roomId,
    meter_type: String(formData.get('meter_type') ?? ''),
    billing_month: String(formData.get('billing_month') ?? ''),
    previous_reading: Number(formData.get('previous_reading')),
    current_reading: Number(formData.get('current_reading')),
    rate: Number(formData.get('rate')),
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('meter_readings')
    .select('id')
    .eq('room_id', parsed.data.room_id)
    .eq('meter_type', parsed.data.meter_type)
    .eq('billing_month', parsed.data.billing_month)
    .maybeSingle();

  assertCan(profile?.role, existing ? 'meters:correct' : 'meters:record');

  const payload = {
    room_id: parsed.data.room_id,
    meter_type: parsed.data.meter_type,
    billing_month: parsed.data.billing_month,
    previous_reading: parsed.data.previous_reading,
    current_reading: parsed.data.current_reading,
    rate: parsed.data.rate,
    note: parsed.data.note ?? null,
    recorded_by: profile!.id,
  };

  const { error } = existing
    ? await supabase.from('meter_readings').update(payload).eq('id', existing.id)
    : await supabase.from('meter_readings').insert(payload);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface DeleteMeterReadingState {
  error: string | null;
}

/** Deletes a meter reading. Owner-only, matching meter_readings' delete RLS. */
export async function deleteMeterReadingAction(
  _previous: DeleteMeterReadingState,
  formData: FormData,
): Promise<DeleteMeterReadingState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'meters:delete');

  const readingId = String(formData.get('reading_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.from('meter_readings').delete().eq('id', readingId);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}
