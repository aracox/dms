'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';
import { cardActionSchema } from '@/lib/validation/schemas';
import type { CardAction, CardStatus } from '@/types/database';

export interface CardActionState {
  error: string | null;
}

const TARGET_STATUS: Record<CardAction, CardStatus> = {
  issue: 'available',
  activate: 'active',
  disable: 'disabled',
  report_lost: 'lost',
  replace: 'active',
  return: 'returned',
  mark_damaged: 'damaged',
};

/**
 * Which current statuses each action is allowed from. `activate` and
 * `replace` both land on 'active' -- the access_cards_log_events trigger
 * (0005) derives its logged `action` purely from the resulting status, so
 * both are recorded as 'activate' in access_card_events regardless of which
 * one the caller used. The distinction here is only which transitions make
 * sense and whether a replacement fee applies.
 */
const ALLOWED_FROM: Record<CardAction, readonly CardStatus[]> = {
  issue: ['returned', 'disabled', 'lost', 'damaged'],
  activate: ['available', 'disabled', 'returned'],
  disable: ['active'],
  report_lost: ['active'],
  // Also allowed straight from 'active': issuing the replacement immediately
  // (with a new UID) without a separate report_lost step first.
  replace: ['active', 'lost', 'damaged'],
  return: ['active'],
  mark_damaged: ['active'],
};

/**
 * The one place access_cards.status is mutated from the app. Every action
 * writes status + notes; issued_date/returned_date and replacement_fee are
 * updated where the action implies them. See ALLOWED_FROM above for why
 * `action` -- not just the target status -- gates the transition.
 */
export async function cardActionAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'cards:write');

  const roomId = String(formData.get('room_id') ?? '');
  const feeRaw = formData.get('replacement_fee');
  const noteRaw = String(formData.get('note') ?? '').trim();
  const cardUidRaw = String(formData.get('card_uid') ?? '').trim();

  const parsed = cardActionSchema.safeParse({
    card_id: String(formData.get('card_id') ?? ''),
    action: String(formData.get('action') ?? ''),
    replacement_fee: feeRaw ? Number(feeRaw) : undefined,
    note: noteRaw || undefined,
    card_uid: cardUidRaw || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const { card_id, action, replacement_fee, note, card_uid } = parsed.data;

  const supabase = await createClient();
  const { data: card } = await supabase
    .from('access_cards')
    .select('status, replacement_fee')
    .eq('id', card_id)
    .maybeSingle();

  if (!card || !ALLOWED_FROM[action].includes(card.status)) {
    return { error: 'errors.generic' };
  }

  const toStatus = TARGET_STATUS[action];
  const update: {
    status: CardStatus;
    notes: string | null;
    issued_date?: string;
    returned_date?: string | null;
    replacement_fee?: number;
    card_uid?: string;
  } = {
    status: toStatus,
    notes: note ?? null,
  };

  if (toStatus === 'active') {
    update.issued_date = bangkokToday();
    update.returned_date = null;
  }
  if (toStatus === 'returned') {
    update.returned_date = bangkokToday();
  }
  if (replacement_fee) {
    update.replacement_fee = card.replacement_fee + replacement_fee;
  }
  // The new physical card issued for a lost/damaged one carries a new UID.
  if (action === 'replace' && card_uid) {
    update.card_uid = card_uid;
  }

  const { error } = await supabase.from('access_cards').update(update).eq('id', card_id);

  if (error) {
    // access_cards_uid_idx: card_uid is unique across the building.
    return { error: error.code === '23505' ? 'cards.uidAlreadyInUse' : 'errors.generic' };
  }

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  revalidatePath('/access-cards');
  return { error: null };
}
