'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import type { Locale } from '@/i18n/routing';
import { formatAmount } from '@/lib/billing/money';
import { recordFinalMeterAction, type RecordFinalMeterState } from '@/lib/contracts/actions';
import { formatDate } from '@/lib/utils/date';

const INITIAL_STATE: RecordFinalMeterState = { error: null };

/**
 * For a tenant who moved out with no final meter numbers -- the daily sweep
 * moves a tenant out on their notice date with nobody there to read the
 * meters. Saving them puts the usage up to move-out day on the last bill.
 */
export function FinalMeterForm({
  contractId,
  movedOutOn,
  lastMeters,
  locale,
}: {
  contractId: string;
  movedOutOn: string;
  /** The meters' last known numbers before move-out, shown so a typo stands out. */
  lastMeters: { electricity: number | null; water: number | null };
  locale: Locale;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(recordFinalMeterAction, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="border-brand-yellow bg-brand-yellow-soft space-y-2 rounded-md border px-3 py-2"
    >
      <input type="hidden" name="contract_id" value={contractId} />
      <p role="status" className="text-ink text-body-sm font-medium">
        {t('contract.finalMeterMissing', { date: formatDate(movedOutOn, locale) })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(['electricity', 'water'] as const).map((type) => (
          <div key={type}>
            <label
              htmlFor={`final_meter_${type}`}
              className="text-ink text-body-sm block font-medium"
            >
              {t(
                type === 'electricity' ? 'contract.meterEndElectricity' : 'contract.meterEndWater',
              )}
              <RequiredMark />
            </label>
            <Input
              id={`final_meter_${type}`}
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
      <Button type="submit" variant="primary" size="sm" disabled={isPending}>
        {isPending ? t('common.loading') : t('contract.saveFinalMeter')}
      </Button>
      {state.error ? <p className="text-brand-red-deep text-caption">{t(state.error)}</p> : null}
    </form>
  );
}
