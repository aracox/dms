'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { deleteMeterReadingAction, type DeleteMeterReadingState } from '@/lib/meters/actions';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import type { MeterReadingRow, MeterType } from '@/types/database';

import { MeterReadingForm } from './MeterReadingForm';

const DELETE_INITIAL_STATE: DeleteMeterReadingState = { error: null };
const METER_TYPES = ['electricity', 'water'] as const;

type FormState = { open: boolean; month: string };

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
  const [forms, setForms] = useState<Record<MeterType, FormState>>({
    electricity: { open: false, month: defaultMonth },
    water: { open: false, month: defaultMonth },
  });

  const editReading = (meterType: MeterType, billingMonth: string) => {
    setForms((prev) => ({ ...prev, [meterType]: { open: true, month: billingMonth.slice(0, 7) } }));
  };

  return (
    <div className="space-y-4">
      {canRecord ? (
        <div className="grid gap-4 md:grid-cols-2">
          {METER_TYPES.map((meterType) => (
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
                  open={forms[meterType].open}
                  month={forms[meterType].month}
                  onOpen={() =>
                    setForms((prev) => ({
                      ...prev,
                      [meterType]: { ...prev[meterType], open: true },
                    }))
                  }
                  onClose={() =>
                    setForms((prev) => ({
                      ...prev,
                      [meterType]: { ...prev[meterType], open: false },
                    }))
                  }
                  onMonthChange={(month) =>
                    setForms((prev) => ({ ...prev, [meterType]: { open: true, month } }))
                  }
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
          />
          <Table
            head={
              <tr>
                <TH>{t('meters.billingMonth')}</TH>
                <TH>{t('common.status')}</TH>
                <TH numeric>{t('meters.previousReading')}</TH>
                <TH numeric>{t('meters.currentReading')}</TH>
                <TH numeric>{t('meters.usage')}</TH>
                <TH numeric>{t('common.rate')}</TH>
                <TH numeric>{t('common.amount')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {readings.map((reading) => (
              <tr key={reading.id}>
                <TD>{formatBillingMonth(reading.billing_month, locale)}</TD>
                <TD>{t(`meterType.${reading.meter_type}`)}</TD>
                <TD numeric>{reading.previous_reading}</TD>
                <TD numeric>{reading.current_reading}</TD>
                <TD numeric className="font-medium">
                  {reading.usage}
                </TD>
                <TD numeric>{reading.rate}</TD>
                <TD numeric className="font-medium">
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
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
