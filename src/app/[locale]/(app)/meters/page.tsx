import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatAmount } from '@/lib/billing/money';
import {
  compareMeterRoomProgress,
  groupMeterReadingsByRoom,
  isMeterRoomForMonth,
  meterRoomIsComplete,
} from '@/lib/meters/room-progress';
import { getFirstMeterMonth, getMeterUsage } from '@/lib/reporting/queries';
import { filterRoomsByView, parseSegmentView, propertySegment } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { cn } from '@/lib/utils/cn';
import {
  addMonths,
  currentBillingMonth,
  formatBillingMonth,
  formatBillingPeriod,
  formatMonthName,
  formatYear,
  type IsoDate,
} from '@/lib/utils/date';

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `?year=2026&month=10` -> '2026-10-01'. A missing or malformed part falls back
 * to `current`, and a future month is clamped to it.
 */
function parseMonth(
  yearParam: string | string[] | undefined,
  monthParam: string | string[] | undefined,
  current: IsoDate,
): IsoDate {
  const year = firstValue(yearParam);
  const month = Number(firstValue(monthParam));
  if (!year || !/^\d{4}$/.test(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return current;
  }
  const picked = `${year}-${String(month).padStart(2, '0')}-01`;
  return picked > current ? current : picked;
}

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

/** The year dropdown always offers 2568-2580 (2025-2037), widened if data or today falls outside. */
const YEAR_RANGE_START = 2025;
const YEAR_RANGE_END = 2037;

export default async function MetersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    segment?: string | string[];
    year?: string | string[];
    month?: string | string[];
    room?: string | string[];
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const query = await searchParams;
  const view = parseSegmentView(query.segment);
  const currentMonth = currentBillingMonth();
  const billingMonth = parseMonth(query.year, query.month, currentMonth);
  const [wholeRooms, usage, firstMeterMonth] = await Promise.all([
    getRoomBoard({ includeTest: false }),
    getMeterUsage(billingMonth),
    getFirstMeterMonth(),
  ]);
  const rooms = filterRoomsByView(view, wholeRooms);
  // A room outside the current segment is ignored rather than showing an empty list.
  const roomFilter = rooms.find((room) => room.room_number === firstValue(query.room))?.room_number;
  // The ‹ arrow stops at the first reading (or the month on screen, if earlier).
  const firstMonth = firstMeterMonth ?? currentMonth;
  const earliestMonth = billingMonth < firstMonth ? billingMonth : firstMonth;
  const selectedYear = Number(billingMonth.slice(0, 4));
  const firstYear = Math.min(YEAR_RANGE_START, Number(earliestMonth.slice(0, 4)));
  const lastYear = Math.max(YEAR_RANGE_END, Number(currentMonth.slice(0, 4)));
  const yearOptions = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );
  // Links back to this page for another month, keeping the segment and room.
  const monthHref = (month: IsoDate) => ({
    pathname: '/meters',
    query: {
      ...(view === 'all' ? {} : { segment: view }),
      ...(month === currentMonth
        ? {}
        : { year: month.slice(0, 4), month: String(Number(month.slice(5, 7))) }),
      ...(roomFilter ? { room: roomFilter } : {}),
    },
  });
  const readingsByRoom = groupMeterReadingsByRoom(usage);
  // The tiles summarise the whole month; the room filter narrows the table only.
  const activeRooms = rooms
    .map((room) => {
      const readings = readingsByRoom.get(room.room_id);
      return { ...room, readings, complete: meterRoomIsComplete(readings) };
    })
    .filter((room) => isMeterRoomForMonth(room, room.readings, billingMonth))
    .sort(compareMeterRoomProgress);
  const listedRooms = roomFilter
    ? activeRooms.filter((room) => room.room_number === roomFilter)
    : activeRooms;
  const filtered = billingMonth !== currentMonth || roomFilter !== undefined;
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
  // ‹ › beside the month and year: one month per click, faded at either end.
  const stepLink = (month: IsoDate | null, direction: 'previous' | 'next') => {
    const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
    const classes = buttonClasses('secondary', 'md', 'w-10 shrink-0 px-0');
    if (month === null) {
      return (
        <span aria-hidden="true" className={cn(classes, 'pointer-events-none opacity-40')}>
          <Icon size={18} />
        </span>
      );
    }
    const label = t(direction === 'previous' ? 'meters.previousMonth' : 'meters.nextMonth');
    return (
      <Link href={monthHref(month)} aria-label={label} title={label} className={classes}>
        <Icon size={18} aria-hidden="true" />
      </Link>
    );
  };
  const periodLabel = formatBillingPeriod(billingMonth, typedLocale);

  return (
    <>
      <PageHeader
        title={t('meters.title')}
        description={t('meters.hubSubtitle', { period: periodLabel })}
        action={
          <SegmentSwitcher
            current={view}
            pathname="/meters"
            query={Object.fromEntries(
              Object.entries(monthHref(billingMonth).query).filter(([key]) => key !== 'segment'),
            )}
          />
        }
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
        {/* A plain GET form: the filters live in the URL, like the segment switcher. */}
        <form
          method="get"
          action={`/${locale}/meters`}
          role="search"
          aria-label={t('meters.filterLabel')}
          className="border-border flex flex-wrap items-center gap-x-4 gap-y-3 border-b p-3"
        >
          {view === 'all' ? null : <input type="hidden" name="segment" value={view} />}
          <div className="flex items-center gap-2">
            <label
              htmlFor="meters-month"
              className="text-ink-muted text-body-sm font-medium whitespace-nowrap"
            >
              {t('meters.filterMonth')}
            </label>
            <div className="flex gap-1.5">
              {stepLink(
                billingMonth > earliestMonth ? addMonths(billingMonth, -1) : null,
                'previous',
              )}
              <Select
                id="meters-month"
                name="month"
                defaultValue={String(Number(billingMonth.slice(5, 7)))}
                className="w-36"
              >
                {MONTH_NUMBERS.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthName(month, typedLocale)}
                  </option>
                ))}
              </Select>
              <Select
                name="year"
                aria-label={t('meters.filterYear')}
                defaultValue={String(selectedYear)}
                className="w-28"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {formatYear(year, typedLocale)}
                  </option>
                ))}
              </Select>
              {stepLink(billingMonth < currentMonth ? addMonths(billingMonth, 1) : null, 'next')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="meters-room"
              className="text-ink-muted text-body-sm font-medium whitespace-nowrap"
            >
              {t('meters.filterRoom')}
            </label>
            <Select id="meters-room" name="room" defaultValue={roomFilter ?? ''} className="w-40">
              <option value="">{t('meters.allRooms')}</option>
              {rooms.map((room) => (
                <option key={room.room_id} value={room.room_number}>
                  {room.room_number}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="primary">
            {t('common.search')}
          </Button>
          {filtered ? (
            <Link
              href={{ pathname: '/meters', query: view === 'all' ? {} : { segment: view } }}
              className={buttonClasses('ghost', 'md')}
            >
              {t('meters.clearFilters')}
            </Link>
          ) : null}
        </form>

        {listedRooms.length === 0 ? (
          <div className="p-4">
            <EmptyState
              message={
                activeRooms.length === 0
                  ? t('billing.noActiveContract')
                  : t('meters.noRoomsMatch', { month: monthLabel })
              }
            />
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
            {listedRooms.map((room) => {
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
                          {t('meters.usageUnits', {
                            units: formatAmount(water.usage, typedLocale),
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
