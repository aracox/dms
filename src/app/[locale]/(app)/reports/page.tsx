import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import {
  getExpiringContracts,
  getMeterUsage,
  getReportRooms,
  getRoomSummary,
  getTenantSummary,
} from '@/lib/reporting/queries';
import { currentBillingMonth, formatBillingMonth, formatDate } from '@/lib/utils/date';

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const month = currentBillingMonth();

  const [summary, tenants, rooms, meterUsage, expiring] = await Promise.all([
    getRoomSummary(),
    getTenantSummary(),
    getReportRooms(),
    getMeterUsage(month),
    // The full contract-expiry report, not just the dashboard's 60-day window.
    getExpiringContracts(3650),
  ]);

  const electricityUnits = meterUsage
    .filter((row) => row.meter_type === 'electricity')
    .reduce((sum, row) => sum + row.usage, 0);
  const waterUnits = meterUsage
    .filter((row) => row.meter_type === 'water')
    .reduce((sum, row) => sum + row.usage, 0);

  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('reports.occupancy')}
          value={`${summary.occupancy_rate}%`}
          hint={`${summary.occupied} / ${summary.total_rooms}`}
          tone="blue"
        />
        <StatTile label={t('dashboard.totalOccupants')} value={tenants.total_occupants} />
        <StatTile
          label={t('room.electricity')}
          value={electricityUnits}
          hint={formatBillingMonth(month, typedLocale)}
          tone="yellow"
        />
        <StatTile
          label={t('room.water')}
          value={waterUnits}
          hint={formatBillingMonth(month, typedLocale)}
          tone="green"
        />
      </div>

      <div className="mb-4">
        <ComingSoon>{t('reports.export')}</ComingSoon>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title={t('reports.occupancy')}
            description={t('rooms.subtitle', { count: rooms.length })}
          />
          <Table
            head={
              <tr>
                <TH>{t('room.roomNumber')}</TH>
                <TH>{t('room.floor')}</TH>
                <TH>{t('room.type')}</TH>
                <TH>{t('common.status')}</TH>
                <TH>{t('room.mainTenant')}</TH>
                <TH numeric>{t('room.occupants')}</TH>
                <TH numeric>{t('room.monthlyRent')}</TH>
              </tr>
            }
          >
            {rooms.map((room) => (
              <tr key={room.room_id}>
                <TD className="font-medium">{room.room_number}</TD>
                <TD>{room.floor}</TD>
                <TD>{t(`roomType.${room.room_type}`)}</TD>
                <TD>
                  <RoomStatusBadge
                    roomStatus={room.room_status}
                    financialStatus={room.financial_status}
                  />
                </TD>
                <TD>{room.tenant_name ?? '-'}</TD>
                <TD numeric>{room.occupant_count ?? '-'}</TD>
                <TD numeric>{formatTHB(room.monthly_rent, typedLocale)}</TD>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader
            title={t('reports.meterUsage')}
            description={formatBillingMonth(month, typedLocale)}
          />
          {meterUsage.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('room.noMeterReading')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH numeric>{t('meters.previousReading')}</TH>
                  <TH numeric>{t('meters.currentReading')}</TH>
                  <TH numeric>{t('meters.usage')}</TH>
                  <TH numeric>{t('common.rate')}</TH>
                  <TH numeric>{t('common.amount')}</TH>
                </tr>
              }
            >
              {meterUsage.map((row) => (
                <tr key={`${row.room_id}-${row.meter_type}`}>
                  <TD className="font-medium">{row.room_number}</TD>
                  <TD>{t(`meterType.${row.meter_type}`)}</TD>
                  <TD numeric>{row.previous_reading}</TD>
                  <TD numeric>{row.current_reading}</TD>
                  <TD numeric className="font-medium">
                    {row.usage}
                  </TD>
                  <TD numeric>{row.rate}</TD>
                  <TD numeric>{formatTHB(row.amount, typedLocale)}</TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title={t('reports.contractExpiry')} />
          {expiring.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noExpiringContracts')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('tenant.title')}</TH>
                  <TH>{t('contract.startDate')}</TH>
                  <TH>{t('contract.endDate')}</TH>
                  <TH numeric>{t('common.days')}</TH>
                  <TH numeric>{t('room.monthlyRent')}</TH>
                </tr>
              }
            >
              {expiring.map((contract) => (
                <tr key={contract.contract_id}>
                  <TD className="font-medium">{contract.room_number}</TD>
                  <TD>{contract.tenant_name}</TD>
                  <TD>{formatDate(contract.start_date, typedLocale)}</TD>
                  <TD>{formatDate(contract.end_date, typedLocale)}</TD>
                  <TD numeric>{contract.days_remaining}</TD>
                  <TD numeric>{formatTHB(contract.monthly_rent, typedLocale)}</TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
