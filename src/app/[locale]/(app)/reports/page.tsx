import { Download } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatAmount, formatTHB } from '@/lib/billing/money';
import {
  getExpiringContracts,
  getMeterUsage,
  getReportRooms,
  getRoomSummary,
  getRoomSummaryBySegment,
  getTenantSummary,
  getTenantSummaryBySegment,
} from '@/lib/reporting/queries';
import { filterByView, forView, parseSegmentView } from '@/lib/reporting/segments';
import { currentBillingMonth, formatBillingMonth, formatDate } from '@/lib/utils/date';

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const view = parseSegmentView((await searchParams).segment);
  const month = currentBillingMonth();

  const [
    wholeSummary,
    summaryBySegment,
    wholeTenants,
    tenantsBySegment,
    allRooms,
    allMeterUsage,
    allExpiring,
  ] = await Promise.all([
    getRoomSummary(),
    getRoomSummaryBySegment(),
    getTenantSummary(),
    getTenantSummaryBySegment(),
    getReportRooms(),
    getMeterUsage(month),
    // The full contract-expiry report, not just the dashboard's 60-day window.
    getExpiringContracts(3650),
  ]);

  const summary = forView(view, wholeSummary, summaryBySegment);
  const tenants = forView(view, wholeTenants, tenantsBySegment);
  const rooms = filterByView(view, allRooms);
  const expiring = filterByView(view, allExpiring);

  /*
   * report_meter_usage has no property_segment column -- 0024 did not add one.
   * Its rows are per room rather than pre-aggregated, though, so the segment
   * comes from the room set above, which does carry it. That keeps the meter
   * report filterable without a new migration.
   */
  const segmentByRoomId = new Map(allRooms.map((room) => [room.room_id, room.property_segment]));
  const meterUsage =
    view === 'all'
      ? allMeterUsage
      : allMeterUsage.filter((row) => segmentByRoomId.get(row.room_id) === view);

  function exportHref(type: 'rooms' | 'meters' | 'contracts'): string {
    return `/reports/export?type=${type}&segment=${view}`;
  }

  const electricityUnits = meterUsage
    .filter((row) => row.meter_type === 'electricity')
    .reduce((sum, row) => sum + row.usage, 0);
  const waterUnits = meterUsage
    .filter((row) => row.meter_type === 'water')
    .reduce((sum, row) => sum + row.usage, 0);

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        action={<SegmentSwitcher current={view} pathname="/reports" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="space-y-6">
        <Card>
          <CardHeader
            title={t('reports.occupancy')}
            description={t('rooms.subtitle', { count: rooms.length })}
            action={
              <Link href={exportHref('rooms')} className={buttonClasses('secondary', 'sm')}>
                <Download size={12} aria-hidden="true" />
                {t('reports.export')}
              </Link>
            }
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
            action={
              <Link href={exportHref('meters')} className={buttonClasses('secondary', 'sm')}>
                <Download size={12} aria-hidden="true" />
                {t('reports.export')}
              </Link>
            }
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
                  <TH>{t('segment.column')}</TH>
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
                  <TD>
                    <SegmentBadge segment={segmentByRoomId.get(row.room_id) ?? null} />
                  </TD>
                  <TD>{t(`meterType.${row.meter_type}`)}</TD>
                  <TD numeric>{formatAmount(row.previous_reading, typedLocale)}</TD>
                  <TD numeric>{formatAmount(row.current_reading, typedLocale)}</TD>
                  <TD numeric className="font-medium">
                    {formatAmount(row.usage, typedLocale)}
                  </TD>
                  <TD numeric>{formatAmount(row.rate, typedLocale)}</TD>
                  <TD numeric>{formatTHB(row.amount, typedLocale)}</TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('reports.contractExpiry')}
            action={
              <Link href={exportHref('contracts')} className={buttonClasses('secondary', 'sm')}>
                <Download size={12} aria-hidden="true" />
                {t('reports.export')}
              </Link>
            }
          />
          {expiring.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noExpiringContracts')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('segment.column')}</TH>
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
                  <TD>
                    <SegmentBadge segment={contract.property_segment} />
                  </TD>
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
