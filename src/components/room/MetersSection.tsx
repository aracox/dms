'use client';

import { Droplet, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { YearStepper } from '@/components/ui/YearStepper';
import type { Locale } from '@/i18n/routing';
import { formatAmount, formatTHB, sumMoney } from '@/lib/billing/money';
import { deleteMeterReadingAction, type DeleteMeterReadingState } from '@/lib/meters/actions';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import type { MeterReadingRow, MeterType } from '@/types/database';

import { MeterReadingForm } from './MeterReadingForm';

const DELETE_INITIAL_STATE: DeleteMeterReadingState = { error: null };
const METER_TYPES = ['electricity', 'water'] as const;

/** Icon + color per meter; the label always sits beside it, so color never stands alone. */
const METER_ICON = {
  electricity: { Icon: Zap, className: 'text-brand-yellow-deep' },
  water: { Icon: Droplet, className: 'text-chart-cat-2' },
} as const;

/** Usage change beyond this (either way) is called out in color, not just the arrow. */
const NOTABLE_CHANGE_PCT = 10;

/** The billing month before `month` (both YYYY-MM-01). */
function previousMonth(month: string): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year!, index! - 2, 1));
  return date.toISOString().slice(0, 10);
}

/** The one meter being recorded or corrected, if any. */
type Editing = { meterType: MeterType; month: string } | null;

function DeleteReadingButton({ roomId, readingId }: { roomId: string; readingId: string }) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(deleteMeterReadingAction, DELETE_INITIAL_STATE);

  return (
    <form action={action}>
      <input type="hidden" name="reading_id" value={readingId} />
      <input type="hidden" name="room_id" value={roomId} />
      <Button
        type="submit"
        variant="link"
        size="sm"
        disabled={isPending}
        className="text-brand-red-deep hover:text-brand-red-deep"
      >
        {isPending ? t('common.loading') : t('common.delete')}
      </Button>
      {state.error ? (
        <p className="text-brand-red-deep text-caption mt-1">{t(state.error)}</p>
      ) : null}
    </form>
  );
}

export function MetersSection({
  roomId,
  readings,
  rates,
  canRecord,
  canCorrect,
  canDelete,
  locale,
}: {
  roomId: string;
  readings: MeterReadingRow[];
  rates: Record<MeterType, number>;
  canRecord: boolean;
  canCorrect: boolean;
  canDelete: boolean;
  locale: Locale;
}) {
  const t = useTranslations();
  const defaultMonth = currentBillingMonth().slice(0, 7);
  const [editing, setEditing] = useState<Editing>(null);

  // Only one meter is edited at a time; while it is, the other card is hidden
  // so the open form gets the full width.
  const visibleTypes = editing ? [editing.meterType] : METER_TYPES;

  // Newest month first; within a month always electricity, then water.
  const monthMap = new Map<string, MeterReadingRow[]>();
  for (const reading of readings) {
    monthMap.set(reading.billing_month, [...(monthMap.get(reading.billing_month) ?? []), reading]);
  }
  const months = [...monthMap]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, entries]) => ({
      month,
      entries: [...entries].sort(
        (a, b) => METER_TYPES.indexOf(a.meter_type) - METER_TYPES.indexOf(b.meter_type),
      ),
    }));
  // Paged by calendar year, newest first; opens on the latest year with readings.
  const years = [...new Set(months.map(({ month }) => Number(month.slice(0, 4))))].sort(
    (a, b) => b - a,
  );
  const [yearChoice, setYear] = useState<number | null>(null);
  const year = yearChoice !== null && years.includes(yearChoice) ? yearChoice : years[0];
  const yearMonths = months.filter(({ month }) => Number(month.slice(0, 4)) === year);
  const older = years.find((candidate) => candidate < (year ?? 0));
  const newer = [...years].reverse().find((candidate) => candidate > (year ?? 0));
  // Thai readers count years in the Buddhist era.
  const yearLabel = (value: number) => String(locale === 'th' ? value + 543 : value);
  const usageByKey = new Map(
    readings.map((reading) => [`${reading.billing_month}:${reading.meter_type}`, reading.usage]),
  );

  const editReading = (meterType: MeterType, billingMonth: string) => {
    setEditing({ meterType, month: billingMonth.slice(0, 7) });
  };

  return (
    <div className="space-y-4">
      {canRecord ? (
        <div className={editing ? undefined : 'grid gap-4 md:grid-cols-2'}>
          {visibleTypes.map((meterType) => (
            <Card key={meterType}>
              <CardHeader title={t(`meterType.${meterType}`)} />
              <CardBody>
                <MeterReadingForm
                  roomId={roomId}
                  meterType={meterType}
                  readings={readings.filter((reading) => reading.meter_type === meterType)}
                  defaultRate={rates[meterType]}
                  canRecord={canRecord}
                  canCorrect={canCorrect}
                  open={editing?.meterType === meterType}
                  month={editing?.meterType === meterType ? editing.month : defaultMonth}
                  onOpen={() => setEditing({ meterType, month: defaultMonth })}
                  onClose={() => setEditing(null)}
                  onMonthChange={(month) => setEditing({ meterType, month })}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {readings.length === 0 ? (
        <EmptyState message={t('room.noMeterReading')} />
      ) : (
        <Card>
          <CardHeader
            title={t('meters.title')}
            // usage and amount are generated columns; nothing here is client-computed.
            description={t('reports.meterUsage')}
            action={
              year === undefined ? null : (
                <YearStepper
                  label={t('reports.yearLabel', { year: yearLabel(year) })}
                  navigationLabel={t('reports.yearNavigation')}
                  previousLabel={
                    older === undefined
                      ? undefined
                      : t('reports.previousYear', { year: yearLabel(older) })
                  }
                  nextLabel={
                    newer === undefined
                      ? undefined
                      : t('reports.nextYear', { year: yearLabel(newer) })
                  }
                  onPrevious={older === undefined ? undefined : () => setYear(older)}
                  onNext={newer === undefined ? undefined : () => setYear(newer)}
                />
              )
            }
          />
          <Table
            head={
              <tr>
                <TH>{t('meters.type')}</TH>
                <TH numeric>{t('meters.previousReading')}</TH>
                <TH numeric>{t('meters.currentReading')}</TH>
                <TH numeric>{t('meters.usage')}</TH>
                <TH numeric>{t('common.rate')}</TH>
                <TH numeric>{t('common.amount')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {yearMonths.map(({ month, entries }) => [
              // One heading row per month with the month's total; readings under it.
              <tr key={month} className="bg-surface-sunken">
                <td colSpan={5} className="text-ink h-10 px-4 py-2 font-semibold">
                  {formatBillingMonth(month, locale)}
                </td>
                <TD numeric className="font-semibold">
                  {formatTHB(sumMoney(entries.map((entry) => entry.amount)), locale)}
                </TD>
                <TD />
              </tr>,
              ...entries.map((reading) => {
                const { Icon, className } = METER_ICON[reading.meter_type];
                const before = usageByKey.get(
                  `${previousMonth(reading.billing_month)}:${reading.meter_type}`,
                );
                // Units, not money -- a display hint only.
                const change =
                  before === undefined || before === 0
                    ? null
                    : Math.round(((reading.usage - before) / before) * 100);
                return (
                  <tr key={reading.id}>
                    <TD>
                      <span className="text-ink flex items-center gap-2">
                        <Icon size={16} aria-hidden="true" className={className} />
                        {t(`meterType.${reading.meter_type}`)}
                      </span>
                    </TD>
                    <TD numeric className="text-ink-subtle">
                      {formatAmount(reading.previous_reading, locale)}
                    </TD>
                    <TD numeric className="text-ink-subtle">
                      {formatAmount(reading.current_reading, locale)}
                    </TD>
                    <TD numeric>
                      <span className="text-ink font-semibold">
                        {formatAmount(reading.usage, locale)}
                      </span>
                      {change === null || change === 0 ? null : (
                        <span
                          title={t('meters.changeVsLastMonth')}
                          className={`text-caption ml-2 inline-flex items-center gap-0.5 font-sans ${
                            change >= NOTABLE_CHANGE_PCT
                              ? 'text-brand-red-deep'
                              : change <= -NOTABLE_CHANGE_PCT
                                ? 'text-brand-green-deep'
                                : 'text-ink-subtle'
                          }`}
                        >
                          {change > 0 ? (
                            <TrendingUp size={12} aria-hidden="true" />
                          ) : (
                            <TrendingDown size={12} aria-hidden="true" />
                          )}
                          {change > 0 ? '+' : ''}
                          {change}%
                        </span>
                      )}
                    </TD>
                    <TD numeric className="text-ink-subtle">
                      {formatAmount(reading.rate, locale)}
                    </TD>
                    <TD numeric className="text-ink font-semibold">
                      {formatTHB(reading.amount, locale)}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        {canCorrect ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => editReading(reading.meter_type, reading.billing_month)}
                            className="text-brand-blue-deep hover:text-brand-blue-deep"
                          >
                            {t('common.edit')}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <DeleteReadingButton roomId={roomId} readingId={reading.id} />
                        ) : null}
                      </div>
                    </TD>
                  </tr>
                );
              }),
            ])}
          </Table>
        </Card>
      )}
    </div>
  );
}
