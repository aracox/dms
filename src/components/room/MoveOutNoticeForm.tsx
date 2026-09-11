'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Locale } from '@/i18n/routing';
import {
  cancelMoveOutNoticeAction,
  giveMoveOutNoticeAction,
  type CancelMoveOutNoticeState,
  type GiveMoveOutNoticeState,
} from '@/lib/contracts/actions';
import { formatDate } from '@/lib/utils/date';

const GIVE_INITIAL: GiveMoveOutNoticeState = { error: null };
const CANCEL_INITIAL: CancelMoveOutNoticeState = { error: null };

/**
 * A tenant on an active contract can tell staff today they're leaving on a
 * future date, well before the lease naturally ends. Recording it here does
 * not touch the room or contract status -- both stay occupied/active until
 * the actual move-out (MoveOutForm) is recorded later. This is only a
 * heads-up so staff can start lining up the next tenant.
 */
export function MoveOutNoticeForm({
  contractId,
  roomId,
  today,
  noticeGivenAt,
  plannedMoveOutDate,
  noticeNote,
  locale,
}: {
  contractId: string;
  roomId: string;
  today: string;
  noticeGivenAt: string | null;
  plannedMoveOutDate: string | null;
  noticeNote: string | null;
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [giveState, giveAction, giveIsPending] = useActionState(
    giveMoveOutNoticeAction,
    GIVE_INITIAL,
  );
  const [cancelState, cancelAction, cancelIsPending] = useActionState(
    cancelMoveOutNoticeAction,
    CANCEL_INITIAL,
  );

  if (noticeGivenAt && plannedMoveOutDate) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="yellow">
            {t('contract.noticeGiven', { date: formatDate(plannedMoveOutDate, locale) })}
          </Badge>
          <form action={cancelAction}>
            <input type="hidden" name="contract_id" value={contractId} />
            <input type="hidden" name="room_id" value={roomId} />
            <Button type="submit" variant="link" size="sm" disabled={cancelIsPending}>
              {cancelIsPending ? t('common.loading') : t('contract.cancelNotice')}
            </Button>
          </form>
        </div>
        {noticeNote ? <p className="text-ink-subtle text-caption">{noticeNote}</p> : null}
        {cancelState.error ? (
          <p className="text-brand-red-deep text-caption">{t(cancelState.error)}</p>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('contract.giveNotice')}
      </Button>
    );
  }

  return (
    <form action={giveAction} className="space-y-2 text-left">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="room_id" value={roomId} />

      <p className="text-ink-subtle text-caption">{t('contract.giveNoticeHint')}</p>

      <div>
        <label className="text-ink text-body-sm block font-medium">
          {t('contract.plannedMoveOutDate')}
        </label>
        <Input
          name="planned_move_out_date"
          type="date"
          min={today}
          defaultValue={today}
          required
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-ink text-body-sm block font-medium">{t('common.note')}</label>
        <Input name="note" type="text" maxLength={1000} className="mt-1" />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={giveIsPending}>
          {giveIsPending ? t('common.loading') : t('contract.giveNotice')}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
          {t('common.close')}
        </Button>
      </div>

      {giveState.error ? (
        <p className="text-brand-red-deep text-caption">{t(giveState.error)}</p>
      ) : null}
    </form>
  );
}
