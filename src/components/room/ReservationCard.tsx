'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { formatTHB } from '@/lib/billing/money';
import {
  createReservationAction,
  forfeitReservationAction,
  type CreateReservationState,
  type ForfeitReservationState,
} from '@/lib/reservations/actions';
import type { Locale } from '@/i18n/routing';
import type { RoomReservationRow } from '@/types/database';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';

const CREATE_INITIAL: CreateReservationState = { error: null };
const FORFEIT_INITIAL: ForfeitReservationState = { error: null };

/**
 * A room -- vacant, occupied, or anything in between -- can be held for a
 * prospect who paid a fee. At most one held reservation per room (0033's
 * partial unique index). Applying the fee to a deposit happens at move-in
 * (see MoveInForm), not here; this only covers holding and forfeiting.
 */
export function ReservationCard({
  roomId,
  reservation,
  canEdit,
  locale,
}: {
  roomId: string;
  reservation: RoomReservationRow | null;
  canEdit: boolean;
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [createState, createAction, createIsPending] = useActionState(
    createReservationAction,
    CREATE_INITIAL,
  );
  const [forfeitState, forfeitAction, forfeitIsPending] = useActionState(
    forfeitReservationAction,
    FORFEIT_INITIAL,
  );

  if (!canEdit && !reservation) return null;

  return (
    <Card>
      <CardHeader title={t('reservation.title')} description={t('reservation.hint')} />
      <CardBody>
        {reservation ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">
                {t('reservation.heldFor', {
                  name: reservation.prospect_name,
                  amount: formatTHB(reservation.amount, locale),
                })}
              </Badge>
              {canEdit ? (
                <form action={forfeitAction}>
                  <input type="hidden" name="reservation_id" value={reservation.id} />
                  <input type="hidden" name="room_id" value={roomId} />
                  <Button type="submit" variant="link" size="sm" disabled={forfeitIsPending}>
                    {forfeitIsPending ? t('common.loading') : t('reservation.forfeit')}
                  </Button>
                </form>
              ) : null}
            </div>
            {reservation.prospect_phone ? (
              <p className="text-ink-subtle text-caption">{reservation.prospect_phone}</p>
            ) : null}
            {reservation.note ? (
              <p className="text-ink-subtle text-caption">{reservation.note}</p>
            ) : null}
            {forfeitState.error ? (
              <p className="text-brand-red-deep text-caption">{t(forfeitState.error)}</p>
            ) : null}
          </div>
        ) : canEdit ? (
          open ? (
            <form action={createAction} className="space-y-2 text-left">
              <input type="hidden" name="room_id" value={roomId} />
              <FormField label={t('reservation.prospectName')} htmlFor="prospect_name">
                <Input id="prospect_name" name="prospect_name" required maxLength={200} />
              </FormField>
              <FormField label={t('reservation.prospectPhone')} htmlFor="prospect_phone">
                <Input id="prospect_phone" name="prospect_phone" />
              </FormField>
              <FormField label={t('reservation.amount')} htmlFor="amount">
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={1000}
                  required
                />
              </FormField>
              <FormField label={t('common.note')} htmlFor="note">
                <Input id="note" name="note" maxLength={500} />
              </FormField>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" variant="primary" size="sm" disabled={createIsPending}>
                  {createIsPending ? t('common.loading') : t('reservation.reserve')}
                </Button>
                <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
                  {t('common.close')}
                </Button>
              </div>
              {createState.error ? (
                <p className="text-brand-red-deep text-caption">{t(createState.error)}</p>
              ) : null}
            </form>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
              {t('reservation.reserve')}
            </Button>
          )
        ) : null}
      </CardBody>
    </Card>
  );
}
