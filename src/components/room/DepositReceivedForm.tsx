'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import {
  recordDepositReceivedAction,
  type RecordDepositReceivedState,
} from '@/lib/contracts/actions';

import { DEPOSIT_METHODS } from './MoveInForm';

const INITIAL_STATE: RecordDepositReceivedState = { error: null };

/** For a deposit not yet recorded as paid: how it was paid, and "received" (today). */
export function DepositReceivedForm({
  contractId,
  roomId,
}: {
  contractId: string;
  roomId: string;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(recordDepositReceivedAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="room_id" value={roomId} />
      <Select
        name="method"
        aria-label={t('payments.method')}
        defaultValue="cash"
        className="h-8 w-auto py-1"
      >
        {DEPOSIT_METHODS.map((method) => (
          <option key={method} value={method}>
            {t(`paymentMethod.${method}`)}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? t('common.loading') : t('contract.markDepositReceived')}
      </Button>
      {state.error ? <p className="text-brand-red-deep text-caption">{t(state.error)}</p> : null}
    </form>
  );
}
