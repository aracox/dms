'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border text-ink hover:bg-surface-sunken rounded-md border px-2.5 py-1 text-xs font-medium"
      >
        {t('contract.moveOut')}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 text-left">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="room_id" value={roomId} />

      <div>
        <label className="text-ink-muted block text-xs font-medium">
          {t('contract.terminatedAt')}
        </label>
        <input
          name="terminated_at"
          type="date"
          defaultValue={today}
          required
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="text-ink-muted block text-xs font-medium">
          {t('contract.terminationReason')}
        </label>
        <input
          name="termination_reason"
          type="text"
          maxLength={500}
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-2 py-1 text-sm"
        />
      </div>

      <label className="text-ink flex items-center gap-2 text-xs">
        <input type="checkbox" name="return_cards" defaultChecked className="accent-brand-blue" />
        {t('cards.returnOnMoveOut')}
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-red hover:bg-brand-red-deep rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isPending ? t('common.loading') : t('contract.terminate')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-subtle text-xs underline"
        >
          {t('common.close')}
        </button>
      </div>

      {state.error ? <p className="text-brand-red-deep text-xs">{t(state.error)}</p> : null}
    </form>
  );
}
