import { useTranslations } from 'next-intl';

import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { RoomDetail } from '@/lib/rooms/queries';
import { formatBillingMonth } from '@/lib/utils/date';

export function RoomMetersTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = useTranslations();

  if (detail.meterReadings.length === 0) {
    return <EmptyState message={t('room.noMeterReading')} />;
  }

  return (
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
          </tr>
        }
      >
        {detail.meterReadings.map((reading) => (
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
          </tr>
        ))}
      </Table>
    </Card>
  );
}
