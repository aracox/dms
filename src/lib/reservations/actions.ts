'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';
import { createReservationSchema } from '@/lib/validation/schemas';

export interface CreateReservationState {
  error: string | null;
}

/**
 * Holds a room for a prospect who paid a fee to reserve it. Works on any
 * room -- already vacant, or one whose current tenant has given move-out
 * notice. Only one open ('held') reservation per room at a time; a second
 * attempt hits the partial unique index from 0033 and reports a friendly
 * error rather than a raw conflict.
 */
export async function createReservationAction(
  _previous: CreateReservationState,
  formData: FormData,
): Promise<CreateReservationState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'rooms:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = createReservationSchema.safeParse({
    room_id: roomId,
    prospect_name: String(formData.get('prospect_name') ?? ''),
    prospect_phone: String(formData.get('prospect_phone') ?? '').trim() || null,
    amount: Number(formData.get('amount')),
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('room_reservations').insert({
    room_id: parsed.data.room_id,
    prospect_name: parsed.data.prospect_name,
    prospect_phone: parsed.data.prospect_phone ?? null,
    amount: parsed.data.amount,
    note: parsed.data.note ?? null,
    created_by: profile!.id,
  });

  if (error) {
    return { error: error.code === '23505' ? 'reservation.alreadyHeld' : 'errors.generic' };
  }

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface ForfeitReservationState {
  error: string | null;
}

/** The prospect never came back to sign; the dormitory keeps the fee. */
export async function forfeitReservationAction(
  _previous: ForfeitReservationState,
  formData: FormData,
): Promise<ForfeitReservationState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'rooms:write');

  const reservationId = String(formData.get('reservation_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase
    .from('room_reservations')
    .update({ status: 'forfeited', resolved_at: bangkokToday() })
    .eq('id', reservationId)
    .eq('status', 'held');

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}
