'use server';

import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

import { redirect } from '@/i18n/navigation';
import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { uploadTenantDocuments } from '@/lib/tenant-documents/upload';
import { moveInSchema } from '@/lib/validation/schemas';

export interface MoveInState {
  error: string | null;
}

/**
 * Registers the tenant, opens the contract, occupies the room, and (if
 * requested) activates the room's cards -- all in one DB transaction via the
 * move_in_room function (0012). See that migration for why a single RPC call
 * is used instead of separate inserts/updates from here.
 *
 * Any uploaded ID documents are attached afterward, best-effort: the contract
 * is the record that matters, and a document that fails to upload here can
 * still be added later from the room's Contract tab.
 */
export async function moveInAction(
  _previous: MoveInState,
  formData: FormData,
): Promise<MoveInState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = moveInSchema.safeParse({
    room_id: roomId,
    tenant: {
      full_name: String(formData.get('full_name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      email: String(formData.get('email') ?? '').trim(),
      id_card_or_passport: String(formData.get('id_card_or_passport') ?? '').trim() || null,
      nationality: String(formData.get('nationality') ?? '').trim() || null,
      emergency_contact: String(formData.get('emergency_contact') ?? '').trim() || null,
      emergency_phone: String(formData.get('emergency_phone') ?? '').trim(),
    },
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? ''),
    monthly_rent: Number(formData.get('monthly_rent')),
    deposit: Number(formData.get('deposit')),
    payment_due_day: Number(formData.get('payment_due_day')),
    occupant_count: Number(formData.get('occupant_count')),
    activate_cards: formData.get('activate_cards') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const { tenant, room_id, ...contractFields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('move_in_room', {
    p_room_id: room_id,
    p_full_name: tenant.full_name,
    p_phone: tenant.phone,
    p_email: tenant.email || null,
    p_id_card_or_passport: tenant.id_card_or_passport ?? null,
    p_nationality: tenant.nationality ?? null,
    p_emergency_contact: tenant.emergency_contact ?? null,
    p_emergency_phone: tenant.emergency_phone || null,
    p_start_date: contractFields.start_date,
    p_end_date: contractFields.end_date,
    p_monthly_rent: contractFields.monthly_rent,
    p_deposit: contractFields.deposit,
    p_payment_due_day: contractFields.payment_due_day,
    p_occupant_count: contractFields.occupant_count,
    p_activate_cards: contractFields.activate_cards,
  });

  if (error) {
    return { error: error.code === '23505' ? 'contract.roomAlreadyOccupied' : 'errors.generic' };
  }

  const tenantId = data?.[0]?.tenant_id;
  const documentFiles = formData
    .getAll('documents')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (tenantId && documentFiles.length > 0) {
    await uploadTenantDocuments(supabase, tenantId, documentFiles, profile!.id);
  }

  revalidatePath('/rooms');
  revalidatePath('/floor-plan');
  revalidatePath(`/rooms/${room_id}`);

  const locale = await getLocale();
  redirect({ href: `/rooms/${room_id}`, locale });

  // redirect() throws. This return exists only because next-intl does not type
  // it as `never`.
  return { error: null };
}
