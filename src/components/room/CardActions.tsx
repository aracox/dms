'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { cardActionAction, type CardActionState } from '@/lib/access-cards/actions';
import type { CardStatus } from '@/types/database';

const INITIAL_STATE: CardActionState = { error: null };

type Action = 'activate' | 'disable' | 'report_lost' | 'replace' | 'return';

/** Mirrors ALLOWED_FROM in lib/access-cards/actions.ts, for the option list. */
const ACTIONS_BY_STATUS: Record<CardStatus, readonly Action[]> = {
  available: ['activate'],
  active: ['disable', 'report_lost', 'replace', 'return'],
  lost: ['replace'],
  disabled: ['activate'],
  damaged: ['replace'],
  returned: ['activate'],
};

/**
 * One dropdown + submit per card -- the set of valid actions depends on the
 * card's current status. report_lost/replace silently apply the settings
 * replacement fee (no fee/note input -- keep this to the status change plus,
 * for replace, the new card's UID).
 */
export function CardActions({
  roomId,
  card,
  defaultReplacementFee,
}: {
  roomId: string;
  card: { id: string; status: CardStatus };
  defaultReplacementFee: number;
}) {
  const t = useTranslations();
  const actions = ACTIONS_BY_STATUS[card.status];
  const fallback = actions[0] ?? 'activate';
  const [action, setAction] = useState<Action>(fallback);
  const [state, formAction, isPending] = useActionState(cardActionAction, INITIAL_STATE);

  // The card's status (and so its valid actions) can change after a
  // successful submit without this component remounting -- fall back to the
  // first valid action rather than keep a selection that's no longer offered.
  const selected = actions.includes(action) ? action : fallback;

  // report_lost is only reachable from 'active', so it's always a fresh
  // charge. replace is reachable from 'active' too (skipping report_lost) or
  // from 'lost'/'damaged', where the fee was normally already charged.
  const fee =
    selected === 'report_lost' || (selected === 'replace' && card.status === 'active')
      ? defaultReplacementFee
      : 0;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="card_id" value={card.id} />
      <input type="hidden" name="replacement_fee" value={fee} />

      <div className="flex flex-wrap items-center gap-2">
        <select
          name="action"
          value={selected}
          onChange={(event) => setAction(event.target.value as Action)}
          className="border-border bg-surface text-ink rounded-md border px-2 py-1.5 text-xs"
        >
          {actions.map((option) => (
            <option key={option} value={option}>
              {t(`cardAction.${option}`)}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-blue hover:bg-brand-blue-deep rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isPending ? t('common.loading') : t('common.save')}
        </button>
      </div>

      {selected === 'replace' ? (
        <input
          name="card_uid"
          type="text"
          maxLength={64}
          placeholder={t('cards.newCardUid')}
          className="border-border bg-surface text-ink w-full rounded-md border px-2 py-1 text-xs"
        />
      ) : null}

      {state.error ? <p className="text-brand-red-deep text-xs">{t(state.error)}</p> : null}
    </form>
  );
}
