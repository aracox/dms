'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { cardActionAction, type CardActionState } from '@/lib/access-cards/actions';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
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
  asTableCells = false,
}: {
  roomId: string;
  card: { id: string; status: CardStatus };
  defaultReplacementFee: number;
  /** Render as two <TD>s (action form, save button) instead of one inline block. */
  asTableCells?: boolean;
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

  const formId = `card-action-${card.id}`;

  const hiddenFields = (
    <>
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="card_id" value={card.id} />
      <input type="hidden" name="replacement_fee" value={fee} />
    </>
  );

  const select = (
    <Select
      name="action"
      value={selected}
      onChange={(event) => setAction(event.target.value as Action)}
      className="w-auto"
    >
      {actions.map((option) => (
        <option key={option} value={option}>
          {t(`cardAction.${option}`)}
        </option>
      ))}
    </Select>
  );

  const replaceInput =
    selected === 'replace' ? (
      <Input name="card_uid" type="text" maxLength={64} placeholder={t('cards.newCardUid')} />
    ) : null;

  const errorMessage = state.error ? (
    <p className="text-brand-red-deep text-caption">{t(state.error)}</p>
  ) : null;

  // form={formId} lets this button submit the form even when it lives in a
  // separate table cell, outside the <form> element itself.
  const saveButton = (
    <Button type="submit" form={formId} size="sm" disabled={isPending}>
      {isPending ? t('common.loading') : t('common.save')}
    </Button>
  );

  if (asTableCells) {
    return (
      <>
        <TD>
          <form id={formId} action={formAction} className="space-y-2">
            {hiddenFields}
            {select}
            {replaceInput}
            {errorMessage}
          </form>
        </TD>
        <TD>{saveButton}</TD>
      </>
    );
  }

  return (
    <form id={formId} action={formAction} className="space-y-2">
      {hiddenFields}
      <div className="flex flex-wrap items-center gap-2">
        {select}
        {saveButton}
      </div>
      {replaceInput}
      {errorMessage}
    </form>
  );
}
