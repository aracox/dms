'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { maintenanceSchema } from '@/lib/validation/schemas';

export interface CreateMaintenanceTicketState {
  error: string | null;
}

const newTicketSchema = maintenanceSchema.pick({
  room_id: true,
  category: true,
  description: true,
  priority: true,
});

/**
 * Opens a new ticket against a room or, with no room_id, a common area.
 * Always starts at 'open' with no cost/technician recorded yet -- those are
 * filled in later as the ticket is worked.
 */
export async function createMaintenanceTicketAction(
  _previous: CreateMaintenanceTicketState,
  formData: FormData,
): Promise<CreateMaintenanceTicketState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'maintenance:write');

  const parsed = newTicketSchema.safeParse({
    room_id: String(formData.get('room_id') ?? '').trim() || null,
    category: String(formData.get('category') ?? ''),
    description: String(formData.get('description') ?? ''),
    priority: String(formData.get('priority') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('maintenance_tickets').insert({
    ...parsed.data,
    status: 'open',
    reported_by: profile!.id,
  });

  if (error) return { error: 'errors.generic' };

  revalidatePath('/maintenance');
  if (parsed.data.room_id) revalidatePath(`/rooms/${parsed.data.room_id}`);
  return { error: null };
}
