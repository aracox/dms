import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatAmount } from '@/lib/billing/money';
import {
  compareMeterRoomProgress,
  groupMeterReadingsByRoom,
  meterRoomIsComplete,
} from '@/lib/meters/room-progress';
import { getMeterUsage } from '@/lib/reporting/queries';
import { filterRoomsByView, parseSegmentView, propertySegment } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { currentBillingMonth, formatBillingMonth, formatBillingPeriod } from '@/lib/utils/date';

export default async function MetersPage({
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
  const billingMonth = currentBillingMonth();
  const [wholeRooms, usage] = await Promise.all([
    getRoomBoard({ includeTest: false }),
    getMeterUsage(billingMonth),
  ]);
  const rooms = filterRoomsByView(view, wholeRooms);
  const readingsByRoom = groupMeterReadingsByRoom(usage);
  const activeRooms = rooms
    .filter((room) => room.contract_status === 'active')
    .map((room) => {
      const readings = readingsByRoom.get(room.room_id);
      return { ...room, readings, complete: meterRoomIsComplete(readings) };
    })
    .sort(compareMeterRoomProgress);
  const completeRooms = activeRooms.filter((room) => room.complete).length;
  const missingReadings = activeRooms.reduce(
    (total, room) => total + Number(!room.readings?.electricity) + Number(!room.readings?.water),
    0,
  );
  const electricityUsage = activeRooms.reduce(
    (total, room) => total + (room.readings?.electricity?.usage ?? 0),
    0,
  );
  const waterUsage = activeRooms.reduce(
    (total, room) => total + (room.readings?.water?.usage ?? 0),
    0,
  );
  const monthLabel = formatBillingMonth(billingMonth, typedLocale);
  const periodLabel = formatBillingPeriod(billingMonth, typedLocale);

  return (
    <>
      <PageHeader
        title={t('meters.title')}
        description={t('meters.hubSubtitle', { period: periodLabel })}
        action={<SegmentSwitcher current={view} pathname="/meters" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label={t('dashboard.totalRooms')} value={rooms.length} tone="blue" />
        <StatTile
          label={t('meters.completeRooms')}
          value={completeRooms}
          hint={t('meters.progress', { complete: completeRooms, total: activeRooms.length })}
          tone="green"
        />
        <StatTile
          label={t('meters.missingReadings')}
          value={missingReadings}
          tone={missingReadings > 0 ? 'yellow' : 'green'}
        />
        <StatTile
          label={t('room.electricity')}
          value={formatAmount(electricityUsage, typedLocale)}
          hint={t('meters.usageUnits', { units: formatAmount(electricityUsage, typedLocale) })}
          tone="yellow"
        />
        <StatTile
          label={t('room.water')}
          value={formatAmount(waterUsage, typedLocale)}
          hint={t('meters.usageUnits', { units: formatAmount(waterUsage, typedLocale) })}
          tone="blue"
        />
      </div>

      <Card>
        <CardHeader
          title={t('meters.billingMonth')}
          description={t('meters.activeRoomCount', {
            count: activeRooms.length,
            total: rooms.length,
            month: monthLabel,
          })}
        />
        {activeRooms.length === 0 ? (
          <div className="p-4">
            <EmptyState message={t('billing.noActiveContract')} />
          </div>
        ) : (
          <Table
            head={
              <tr>
                <TH>{t('room.roomNumber')}</TH>
                <TH>{t('segment.column')}</TH>
                <TH>{t('tenant.title')}</TH>
                <TH>{t('room.electricity')}</TH>
                <TH>{t('room.water')}</TH>
                <TH>{t('common.status')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {activeRooms.map((room) => {
              const meterHref = `/meters/${room.room_id}`;
              const electricity = room.readings?.electricity;
              const water = room.readings?.water;

              return (
                <tr key={room.room_id}>
                  <TD>
                    <Link href={meterHref} className="text-brand-blue-deep font-semibold underline">
                      {room.room_number}
                    </Link>
                  </TD>
                  <TD>
                    <SegmentBadge segment={propertySegment(room.room_type)} />
                  </TD>
                  <TD>{room.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD>
                    {electricity ? (
                      <div>
                        <p className="font-semibold tabular-nums">
                          {formatAmount(electricity.current_reading, typedLocale)}
                        </p>
                        <p className="text-ink-subtle text-caption">
                          {t('meters.usageUnits', {
                            units: formatAmount(electricity.usage, typedLocale),
                          })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-brand-yellow-deep font-medium">
                        {t('meters.missing')}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {water ? (
                      <div>
                        <p className="font-semibold tabular-nums">
                          {formatAmount(water.current_reading, typedLocale)}
                        </p>
                        <p className="text-ink-subtle text-caption">
                          {t('meters.usageUnits', { units: formatAmount(water.usage, typedLocale) })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-brand-yellow-deep font-medium">
                        {t('meters.missing')}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={room.complete ? 'green' : 'yellow'}>
                      {t(room.complete ? 'meters.complete' : 'meters.incomplete')}
                    </Badge>
                  </TD>
                  <TD>
                    <Link href={meterHref} className={buttonClasses('secondary', 'sm')}>
                      {t('meters.openMeters')}
                    </Link>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
