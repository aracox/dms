'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { recordMeterReadingAction, type RecordMeterReadingState } from '@/lib/meters/actions';
import type { MeterReadingRow, MeterType } from '@/types/database';

const SAVE_INITIAL_STATE: RecordMeterReadingState = { error: null };

/**
 * Collapsed by default: a "+ Record reading" button reveals a month picker
 * and the reading fields. Open/month are controlled by the parent so a row's
 * "Edit" action in the history table can point this form at that row's month.
 */
export function MeterReadingForm({
  roomId,
  meterType,
  readings,
  defaultRate,
  canRecord,
  canCorrect,
  open,
  month,
  onOpen,
  onClose,
  onMonthChange,
}: {
  roomId: string;
  meterType: MeterType;
  readings: MeterReadingRow[];
  defaultRate: number;
  canRecord: boolean;
  canCorrect: boolean;
  open: boolean;
  month: string;
  onOpen: () => void;
  onClose: () => void;
  onMonthChange: (month: string) => void;
}) {
  const t = useTranslations();
  const [saveState, saveAction, isSaving] = useActionState(
    recordMeterReadingAction,
    SAVE_INITIAL_STATE,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="border-border text-ink-muted hover:bg-surface-sunken rounded-md border px-3 py-2 text-sm"
      >
        + {t('meters.recordReading')}
      </button>
    );
  }

  const billingMonth = `${month}-01`;
  const existing = readings.find((reading) => reading.billing_month === billingMonth);
  const previousDefault =
    existing?.previous_reading ??
    [...readings]
      .filter((reading) => reading.billing_month < billingMonth)
      .sort((a, b) => (a.billing_month < b.billing_month ? 1 : -1))[0]?.current_reading ??
    0;
  const canSave = existing ? canCorrect : canRecord;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-ink-muted text-xs font-medium">
          {t('meters.billingMonth')}
          <input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="border-border bg-surface text-ink mt-1 block rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <button type="button" onClick={onClose} className="text-ink-subtle text-xs underline">
          {t('common.close')}
        </button>
      </div>

      <form
        key={month}
        action={saveAction}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end"
      >
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="meter_type" value={meterType} />
        <input type="hidden" name="billing_month" value={billingMonth} />

        <div>
          <label className="text-ink-muted block text-xs font-medium">
            {t('meters.previousReading')}
          </label>
          <input
            name="previous_reading"
            type="number"
            min={0}
            step="0.01"
            defaultValue={previousDefault}
            required
            className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-ink-muted block text-xs font-medium">
            {t('meters.currentReading')}
          </label>
          <input
            name="current_reading"
            type="number"
            min={0}
            step="0.01"
            defaultValue={existing?.current_reading || undefined}
            required
            className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-ink-muted block text-xs font-medium">{t('common.rate')}</label>
          <input
            name="rate"
            type="number"
            min={0}
            step="0.0001"
            defaultValue={existing?.rate ?? defaultRate}
            required
            className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving || !canSave}
          className="bg-brand-blue hover:bg-brand-blue-deep h-fit rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? t('common.loading') : t('common.save')}
        </button>
      </form>

      {!canSave ? (
        <p className="text-brand-red-deep text-xs">{t('meters.correctPermissionRequired')}</p>
      ) : null}
      {saveState.error ? <p className="text-brand-red-deep text-xs">{t(saveState.error)}</p> : null}
    </div>
  );
}
