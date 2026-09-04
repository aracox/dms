'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { moveOutAction, type MoveOutState } from '@/lib/rooms/actions';

const INITIAL_STATE: MoveOutState = { error: null };

/** Collapsed by default: "Move out" reveals the termination form. */
export function MoveOutForm({
  contractId,
  roomId,
  today,
}: {
  contractId: string;
  roomId: string;
  today: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(moveOutAction, INITIAL_STATE);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('contract.moveOut')}
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 text-left">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="room_id" value={roomId} />

      <div>
        <label className="text-ink text-body-sm block font-medium">
          {t('contract.terminatedAt')}
        </label>
        <Input name="terminated_at" type="date" defaultValue={today} required className="mt-1" />
      </div>

      <div>
        <label className="text-ink text-body-sm block font-medium">
          {t('contract.terminationReason')}
        </label>
        <Input name="termination_reason" type="text" maxLength={500} className="mt-1" />
      </div>

      <label className="text-ink text-body-sm flex items-center gap-2">
        <input
          type="checkbox"
          name="return_cards"
          defaultChecked
          className="accent-brand-blue size-5 rounded-sm"
        />
        {t('cards.returnOnMoveOut')}
      </label>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
          {isPending ? t('common.loading') : t('contract.terminate')}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
          {t('common.close')}
        </Button>
      </div>

      {state.error ? <p className="text-brand-red-deep text-caption">{t(state.error)}</p> : null}
    </form>
  );
}
