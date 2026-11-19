import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { RefundsTable } from '@/components/deposits/RefundsTable';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { MonthFilter } from '@/components/ui/MonthFilter';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { getDepositRefunds, type DepositRefundRecord } from '@/lib/contracts/queries';
import { can } from '@/lib/permissions';
import { filterRoomsByView, parseSegmentView, propertySegment } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { billingMonthOf, currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import {
  firstParam,
  monthQuery,
  parseMonthParams,
  type SearchParam,
} from '@/lib/utils/month-filter';

/** The month a tenant moved out: their termination date, else the contract's end. */
function moveOutMonth(record: DepositRefundRecord) {
  return billingMonthOf(record.contract.terminated_at ?? record.contract.end_date);
}

export default async function RefundsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    segment?: SearchParam;
    year?: SearchParam;
    month?: SearchParam;
    room?: SearchParam;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const query = await searchParams;
  const view = parseSegmentView(query.segment);
  const currentMonth = currentBillingMonth();
  const month = parseMonthParams(query.year, query.month, currentMonth) ?? currentMonth;
  const [records, wholeRooms, profile] = await Promise.all([
    getDepositRefunds(),
    getRoomBoard({ includeTest: false }),
    getCurrentProfile(),
  ]);
  const canWrite = can(profile?.role, 'contracts:write');
  const rooms = filterRoomsByView(view, wholeRooms);
  // A room outside the current segment is ignored rather than showing an empty list.
  const roomFilter = rooms.find((room) => room.room_number === firstParam(query.room))?.room_number;
  const shown = records.filter(
    (record) =>
      (view === 'all' || propertySegment(record.roomType) === view) &&
      (roomFilter === undefined || record.roomNumber === roomFilter),
  );
  // Waiting refunds are a to-do list: every month stays listed so none is
  // missed. The month search narrows only the refunds already made.
  const pending = records.filter((record) => record.status === 'pending');
  const listedPending = shown.filter((record) => record.status === 'pending');
  const refunded = shown.filter(
    (record) => record.status === 'refunded' && moveOutMonth(record) === month,
  );
  const firstMonth = records
    .filter((record) => record.status === 'refunded')
    .map(moveOutMonth)
    .reduce((a, b) => (b < a ? b : a), currentMonth);
  const monthLabel = formatBillingMonth(month, typedLocale);

  return (
    <>
      <PageHeader
        title={t('deposits.title')}
        description={
          pending.length > 0
            ? t('deposits.subtitle', {
                count: pending.length,
                amount: formatTHB(
                  sumMoney(pending.map((record) => record.contract.deposit)),
                  typedLocale,
                ),
              })
            : t('deposits.nonePending')
        }
        action={
          <SegmentSwitcher
            current={view}
            pathname="/refunds"
            query={monthQuery(month, currentMonth, { room: roomFilter })}
          />
        }
      />

      <div className="space-y-4">
        <Card>
          <MonthFilter
            label={t('deposits.filterLabel')}
            pathname="/refunds"
            month={month}
            defaultMonth={currentMonth}
            currentMonth={currentMonth}
            firstMonth={firstMonth}
            choice={{
              name: 'room',
              label: t('filters.room'),
              allLabel: t('filters.allRooms'),
              options: rooms.map((room) => ({ value: room.room_number, label: room.room_number })),
              value: roomFilter,
            }}
            keep={view === 'all' ? {} : { segment: view }}
            className="border-b-0"
          />
        </Card>

        <Card>
          <CardHeader title={t('deposits.pendingTitle')} />
          <RefundsTable
            records={listedPending}
            canWrite={canWrite}
            locale={typedLocale}
            emptyMessage={t('deposits.nonePending')}
          />
        </Card>

        <Card>
          <CardHeader title={t('deposits.refundedFor', { month: monthLabel })} />
          <RefundsTable
            records={refunded}
            canWrite={canWrite}
            locale={typedLocale}
            emptyMessage={t('deposits.noRefundedInMonth', { month: monthLabel })}
          />
        </Card>
      </div>
    </>
  );
}
