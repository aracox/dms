import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BulkGenerateInvoicesButton } from '@/components/billing/BulkGenerateInvoicesButton';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { INVOICE_TONE } from '@/components/room/RoomBillingTab';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthFilter } from '@/components/ui/MonthFilter';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import { filterRoomsByView, parseSegmentView, propertySegment } from '@/lib/reporting/segments';
import {
  getBillsForMonth,
  getFirstBillMonth,
  getRoomBoard,
  type MonthBill,
} from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { billingMonthOf, currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import {
  firstParam,
  isRoomForMonth,
  monthQuery,
  parseMonthParams,
  type SearchParam,
} from '@/lib/utils/month-filter';
import type { FinancialStatus, InvoiceStatus, RoomBoardRow } from '@/types/database';

/** The bill-status chips over the room list; 'none' is a room with no live bill yet. */
const STATUS_FILTERS = [
  'all',
  'none',
  'draft',
  'issued',
  'partially_paid',
  'overdue',
  'paid',
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function parseStatusFilter(value: SearchParam): StatusFilter {
  const candidate = firstParam(value);
  return STATUS_FILTERS.includes(candidate as StatusFilter) ? (candidate as StatusFilter) : 'all';
}

/**
 * Puts a month's bill in place of the room board's latest one, naming the
 * tenant on the bill's own contract. The money status follows v_room_board's
 * rules, except that overdue comes from the bill itself (the daily sweep marks
 * it) rather than from the grace-day arithmetic. A move-in month is billed
 * (prorated), so a room without a bill is simply 'none'.
 */
function withMonthBill(room: RoomBoardRow, bill: MonthBill | undefined) {
  const financialStatus: FinancialStatus = !bill
    ? 'none'
    : bill.status === 'paid'
      ? 'paid'
      : bill.status === 'overdue'
        ? 'overdue'
        : bill.status === 'draft'
          ? 'none'
          : 'payment_due';
  return {
    ...room,
    tenant_name: bill ? bill.tenant_name : room.tenant_name,
    invoice_id: bill?.invoice_id ?? null,
    billing_month: bill?.billing_month ?? null,
    invoice_status: bill?.status ?? null,
    outstanding: bill?.outstanding ?? 0,
    financial_status: financialStatus,
  };
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    segment?: SearchParam;
    status?: SearchParam;
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
  const status = parseStatusFilter(query.status);
  const profile = await getCurrentProfile();
  const canGenerate = can(profile?.role, 'invoices:write');
  const currentMonth = currentBillingMonth();
  const month = parseMonthParams(query.year, query.month, currentMonth) ?? currentMonth;
  const [wholeRooms, monthBills, firstBillMonth] = await Promise.all([
    getRoomBoard({ includeTest: false }),
    getBillsForMonth(month),
    getFirstBillMonth(),
  ]);
  const rooms = filterRoomsByView(view, wholeRooms);
  // A room outside the current segment is ignored rather than showing an empty list.
  const roomFilter = rooms.find((room) => room.room_number === firstParam(query.room))?.room_number;
  const searchQuery = monthQuery(month, currentMonth, { room: roomFilter });
  // Every tile below derives from activeRooms, so they follow the segment and
  // month; the room search narrows the chips and the table only.
  // Listed in room-number order, as getRoomBoard returns them.
  const activeRooms = rooms
    .filter((room) => isRoomForMonth(room, monthBills.has(room.room_id), month))
    .flatMap((room) => {
      // One row per bill -- two in a turnover month -- plus a "no bill" row for
      // the tenant in the room now if their contract has none yet.
      const bills = monthBills.get(room.room_id) ?? [];
      const currentTenantBilled =
        room.contract_id === null ||
        billingMonthOf(room.start_date ?? month) > month ||
        bills.some((bill) => bill.contract_id === room.contract_id);
      return [
        ...bills.map((bill) => withMonthBill(room, bill)),
        ...(currentTenantBilled ? [] : [withMonthBill(room, undefined)]),
      ];
    });
  const searchedRooms = roomFilter
    ? activeRooms.filter((room) => room.room_number === roomFilter)
    : activeRooms;
  // The room board never carries a cancelled bill (it skips them), so every
  // status here has a chip.
  const statusOf = (room: (typeof activeRooms)[number]): InvoiceStatus | 'none' =>
    room.invoice_status ?? 'none';
  const statusCounts = Object.fromEntries(
    STATUS_FILTERS.map((option) => [
      option,
      option === 'all'
        ? searchedRooms.length
        : searchedRooms.filter((room) => statusOf(room) === option).length,
    ]),
  ) as Record<StatusFilter, number>;
  const listedRooms =
    status === 'all' ? searchedRooms : searchedRooms.filter((room) => statusOf(room) === status);
  const totalOutstanding = activeRooms.reduce((sum, room) => sum + room.outstanding, 0);
  const overdueRooms = activeRooms.filter((room) => room.financial_status === 'overdue').length;
  // A move-in month is billed too (prorated), so every row without a bill counts.
  const roomsWithoutInvoice = activeRooms.filter((room) => room.invoice_id === null).length;

  return (
    <>
      <PageHeader
        title={t('billing.title')}
        description={t('billing.hubSubtitle')}
        action={
          <SegmentSwitcher
            current={view}
            pathname="/billing"
            query={{ ...searchQuery, ...(status === 'all' ? {} : { status }) }}
          />
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <StatTile label={t('billing.activeRooms')} value={activeRooms.length} tone="blue" />
        <StatTile
          label={t('billing.outstanding')}
          value={formatTHB(totalOutstanding, typedLocale)}
          tone={totalOutstanding > 0 ? 'yellow' : 'green'}
        />
        <StatTile label={t('billing.overdueRooms')} value={overdueRooms} tone="red" />
        <StatTile label={t('billing.withoutInvoice')} value={roomsWithoutInvoice} />
      </div>

      <Card>
        <MonthFilter
          label={t('billing.filterLabel')}
          pathname="/billing"
          month={month}
          defaultMonth={currentMonth}
          currentMonth={currentMonth}
          firstMonth={firstBillMonth ?? currentMonth}
          choice={{
            name: 'room',
            label: t('filters.room'),
            allLabel: t('filters.allRooms'),
            options: rooms.map((room) => ({ value: room.room_number, label: room.room_number })),
            value: roomFilter,
          }}
          keep={view === 'all' ? {} : { segment: view }}
        />
        {/* Status chips filter the table only; the tiles above stay whole-list totals. */}
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div
            role="group"
            aria-label={t('billing.filterByStatus')}
            className="flex flex-wrap items-center gap-1.5"
          >
            {STATUS_FILTERS.filter(
              (option) => option === 'all' || option === status || statusCounts[option] > 0,
            ).map((option) => (
              <Link
                key={option}
                href={{
                  pathname: '/billing',
                  query: {
                    ...(view === 'all' ? {} : { segment: view }),
                    ...searchQuery,
                    ...(option === 'all' ? {} : { status: option }),
                  },
                }}
                aria-current={option === status ? 'true' : undefined}
                className={buttonClasses(option === status ? 'primary' : 'secondary', 'sm')}
              >
                {option === 'all'
                  ? t('billing.allStatuses')
                  : option === 'none'
                    ? t('room.noInvoice')
                    : t(`invoiceStatus.${option}`)}
                <span className="opacity-75">({statusCounts[option]})</span>
              </Link>
            ))}
          </div>
          {canGenerate ? <BulkGenerateInvoicesButton /> : null}
        </div>

        {listedRooms.length === 0 ? (
          <div className="p-4">
            <EmptyState
              message={
                activeRooms.length === 0
                  ? t('billing.noActiveContract')
                  : searchedRooms.length > 0
                    ? t('billing.noRoomsWithStatus')
                    : t('filters.noRoomsMatch', { month: formatBillingMonth(month, typedLocale) })
              }
            />
          </div>
        ) : (
          <Table
            className="min-w-[42rem]"
            head={
              <tr>
                <TH>{t('room.roomNumber')}</TH>
                <TH>{t('tenant.title')}</TH>
                <TH>{t('common.month')}</TH>
                <TH>{t('common.status')}</TH>
                <TH numeric>{t('billing.outstanding')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {listedRooms.map((room) => {
              const billingHref = `/billing/${room.room_id}`;

              return (
                <tr key={`${room.room_id}-${room.invoice_id ?? 'none'}`}>
                  <TD className="whitespace-nowrap">
                    <Link
                      href={billingHref}
                      className="text-brand-blue-deep font-semibold hover:underline"
                    >
                      {room.room_number}
                    </Link>
                    <span className="text-ink-muted text-caption mt-0.5 block">
                      {t(`segment.${propertySegment(room.room_type)}`)}
                    </span>
                  </TD>
                  <TD>{room.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD className="whitespace-nowrap">
                    {room.billing_month
                      ? formatBillingMonth(room.billing_month, typedLocale)
                      : t('common.notAvailable')}
                  </TD>
                  <TD>
                    {room.invoice_status ? (
                      <Badge tone={INVOICE_TONE[room.invoice_status]}>
                        {t(`invoiceStatus.${room.invoice_status}`)}
                      </Badge>
                    ) : (
                      <span className="text-ink-subtle">{t('room.noInvoice')}</span>
                    )}
                  </TD>
                  <TD
                    numeric
                    className={room.outstanding > 0 ? 'font-semibold' : 'text-ink-subtle'}
                  >
                    {room.outstanding > 0
                      ? formatTHB(room.outstanding, typedLocale)
                      : t('common.notAvailable')}
                  </TD>
                  <TD>
                    <Link href={billingHref} className={buttonClasses('secondary', 'sm')}>
                      {t('billing.openBilling')}
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
