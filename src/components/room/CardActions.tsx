'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { cardActionAction, type CardActionState } from '@/lib/access-cards/actions';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
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
 * A single valid transition is a direct button. Multiple valid transitions use
 * an explicit action choice followed by a command-labelled button. Actions that
 * create a replacement fee show it before submission.
 */
export function CardActions({
  roomId,
  card,
  defaultReplacementFee,
  locale,
  asTableCell = false,
}: {
  roomId: string;
  card: { id: string; status: CardStatus };
  defaultReplacementFee: number;
  locale: Locale;
  /** Render the action form inside one table cell. */
  asTableCell?: boolean;
}) {
  const t = useTranslations();
  const actions = ACTIONS_BY_STATUS[card.status];
  const onlyAction = actions.length === 1 ? actions[0] : undefined;
  const [action, setAction] = useState<Action | ''>(onlyAction ?? '');
  const [state, formAction, isPending] = useActionState(cardActionAction, INITIAL_STATE);

  // The card's status (and so its valid actions) can change after a
  // successful submit without this component remounting -- fall back to the
  // first valid action rather than keep a selection that's no longer offered.
  const selected = action && actions.includes(action) ? action : (onlyAction ?? '');

  // report_lost is only reachable from 'active', so it's always a fresh
  // charge. replace is reachable from 'active' too (skipping report_lost) or
  // from 'lost'/'damaged', where the fee was normally already charged.
  const fee =
    selected === 'report_lost' || (selected === 'replace' && card.status === 'active')
      ? defaultReplacementFee
      : 0;

  const hiddenFields = (
    <>
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="card_id" value={card.id} />
      <input type="hidden" name="replacement_fee" value={fee} />
    </>
  );

  const actionControl = onlyAction ? (
    <input type="hidden" name="action" value={onlyAction} />
  ) : (
    <Select
      name="action"
      value={selected}
      required
      aria-label={t('cards.chooseAction')}
      onChange={(event) => setAction(event.target.value as Action)}
      className="w-auto"
    >
      <option value="" disabled>
        {t('cards.chooseAction')}
      </option>
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

  const actionButton = selected ? (
    <Button
      type="submit"
      size="sm"
      variant={selected === 'report_lost' ? 'destructive' : 'secondary'}
      disabled={isPending}
    >
      {isPending ? t('common.loading') : t(`cardAction.${selected}`)}
    </Button>
  ) : null;

  const form = (
    <form action={formAction} className="space-y-2">
      {hiddenFields}
      <div className="flex flex-wrap items-center gap-2">
        {actionControl}
        {replaceInput}
        {actionButton}
      </div>
      {fee > 0 ? (
        <p className="text-brand-red-deep text-caption">
          {t('cards.replacementFee')}: {formatTHB(fee, locale)}
        </p>
      ) : null}
      {errorMessage}
    </form>
  );

  return asTableCell ? <TD>{form}</TD> : form;
}
