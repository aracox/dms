import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import {
  compareMeterRoomProgress,
  groupMeterReadingsByRoom,
  meterRoomIsComplete,
} from '@/lib/meters/room-progress';
import { getMeterUsage } from '@/lib/reporting/queries';
import { getRoomBoard } from '@/lib/rooms/queries';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';

export default async function MetersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const billingMonth = currentBillingMonth();
  const [rooms, usage] = await Promise.all([
    getRoomBoard({ includeTest: false }),
    getMeterUsage(billingMonth),
  ]);
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

  return (
    <>
      <PageHeader
        title={t('meters.title')}
        description={t('meters.hubSubtitle', { month: monthLabel })}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          value={electricityUsage}
          hint={t('meters.usageUnits', { units: electricityUsage })}
          tone="yellow"
        />
        <StatTile
          label={t('room.water')}
          value={waterUsage}
          hint={t('meters.usageUnits', { units: waterUsage })}
          tone="blue"
        />
      </div>

      <Card>
        <CardHeader
          title={t('meters.billingMonth')}
          description={t('meters.activeRoomCount', {
            count: activeRooms.length,
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
                  <TD>{room.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD>
                    {electricity ? (
                      <div>
                        <p className="font-semibold tabular-nums">{electricity.current_reading}</p>
                        <p className="text-ink-subtle text-caption">
                          {t('meters.usageUnits', { units: electricity.usage })}
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
                        <p className="font-semibold tabular-nums">{water.current_reading}</p>
                        <p className="text-ink-subtle text-caption">
                          {t('meters.usageUnits', { units: water.usage })}
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
