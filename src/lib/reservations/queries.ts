import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { RoomReservationRow } from '@/types/database';

/** The room's open hold, if any -- at most one per room (0033's partial unique index). */
export async function getHeldReservation(roomId: string): Promise<RoomReservationRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('room_reservations')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'held')
    .maybeSingle();
  return data ?? null;
}

/** Past reservations for a room (applied or forfeited), newest first. */
export async function getReservationHistory(roomId: string): Promise<RoomReservationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('room_reservations')
    .select('*')
    .eq('room_id', roomId)
    .neq('status', 'held')
    .order('created_at', { ascending: false });
  return data ?? [];
}
