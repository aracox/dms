'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import type { Locale } from '@/i18n/routing';
import { formatAmount, formatTHB } from '@/lib/billing/money';
import { moveOutAction, type MoveOutState } from '@/lib/rooms/actions';

const INITIAL_STATE: MoveOutState = { error: null };

/**
 * Collapsed by default: "Move out" reveals the termination form. It warns
 * when the tenant still owes on their bills -- the owner normally collects
 * before the keys come back -- and takes the meters' final numbers, which put
 * the usage up to move-out day on the tenant's last bill.
 */
export function MoveOutForm({
  contractId,
  roomId,
  today,
  owed,
  paidBills,
  lastMeters,
  locale,
}: {
  contractId: string;
  roomId: string;
  today: string;
  /** Still unpaid on this contract's issued bills (amountOwed). */
  owed: number;
  /** This contract's bills from this month on that already have money on them. */
  paidBills: string[];
  /** The meters' last known numbers, shown so a typo stands out. */
  lastMeters: { electricity: number | null; water: number | null };
  locale: Locale;
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
    <form action={formAction} className="w-full space-y-2 text-left">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="room_id" value={roomId} />

      {owed > 0 ? (
        <p
          role="status"
          className="border-brand-yellow bg-brand-yellow-soft text-ink text-caption rounded-md border px-3 py-2"
        >
          {t('contract.moveOutOwedWarning', { amount: formatTHB(owed, locale) })}
        </p>
      ) : null}

      <div>
        <label className="text-ink text-body-sm block font-medium">
          {t('contract.terminatedAt')}
        </label>
        <Input
          name="terminated_at"
          type="date"
          defaultValue={today}
          max={today}
          required
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['electricity', 'water'] as const).map((type) => (
          <div key={type}>
            <label className="text-ink text-body-sm block font-medium">
              {t(
                type === 'electricity' ? 'contract.meterEndElectricity' : 'contract.meterEndWater',
              )}
              <RequiredMark />
            </label>
            <Input
              name={`meter_end_${type}`}
              type="number"
              min={0}
              step="0.01"
              required
              className="mt-1"
            />
            {lastMeters[type] !== null ? (
              <p className="text-ink-subtle text-caption mt-1">
                {t('contract.meterLast', { value: formatAmount(lastMeters[type], locale) })}
              </p>
            ) : null}
          </div>
        ))}
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

      <p className="text-ink-subtle text-caption">{t('contract.moveOutLastBillHint')}</p>
      {paidBills.length > 0 ? (
        <p className="text-ink-subtle text-caption">
          {t('contract.moveOutPaidBillsHint', { invoices: paidBills.join(', ') })}
        </p>
      ) : null}

      {state.error ? <p className="text-brand-red-deep text-caption">{t(state.error)}</p> : null}
    </form>
  );
}
