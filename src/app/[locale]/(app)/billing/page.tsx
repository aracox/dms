import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BulkGenerateInvoicesButton } from '@/components/billing/BulkGenerateInvoicesButton';
import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { INVOICE_TONE } from '@/components/room/RoomBillingTab';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import { filterRoomsByView, parseSegmentView, propertySegment } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { formatBillingMonth } from '@/lib/utils/date';
import type { InvoiceStatus } from '@/types/database';

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

function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return STATUS_FILTERS.includes(candidate as StatusFilter) ? (candidate as StatusFilter) : 'all';
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string | string[]; status?: string | string[] }>;
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
  const rooms = filterRoomsByView(view, await getRoomBoard({ includeTest: false }));
  // Every tile below derives from activeRooms, so they follow the filter too.
  // Listed in room-number order, as getRoomBoard returns them.
  const activeRooms = rooms.filter((room) => room.contract_status === 'active');
  // The room board never carries a cancelled bill (it skips them), so every
  // status here has a chip.
  const statusOf = (room: (typeof activeRooms)[number]): InvoiceStatus | 'none' =>
    room.invoice_status ?? 'none';
  const statusCounts = Object.fromEntries(
    STATUS_FILTERS.map((option) => [
      option,
      option === 'all'
        ? activeRooms.length
        : activeRooms.filter((room) => statusOf(room) === option).length,
    ]),
  ) as Record<StatusFilter, number>;
  const listedRooms =
    status === 'all' ? activeRooms : activeRooms.filter((room) => statusOf(room) === status);
  const totalOutstanding = activeRooms.reduce((sum, room) => sum + room.outstanding, 0);
  const overdueRooms = activeRooms.filter((room) => room.financial_status === 'overdue').length;
  // A tenant who moved in this month is not behind yet -- their first bill is next month's.
  const roomsWithoutInvoice = activeRooms.filter(
    (room) => room.invoice_id === null && room.financial_status !== 'first_month',
  ).length;

  return (
    <>
      <PageHeader
        title={t('billing.title')}
        description={t('billing.hubSubtitle')}
        action={
          <SegmentSwitcher
            current={view}
            pathname="/billing"
            query={status === 'all' ? {} : { status }}
          />
        }
      />

      {canGenerate ? (
        <div className="mb-6">
          <BulkGenerateInvoicesButton />
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t('billing.activeRooms')} value={activeRooms.length} tone="blue" />
        <StatTile
          label={t('billing.outstanding')}
          value={formatTHB(totalOutstanding, typedLocale)}
          tone={totalOutstanding > 0 ? 'yellow' : 'green'}
        />
        <StatTile label={t('billing.overdueRooms')} value={overdueRooms} tone="red" />
        <StatTile label={t('billing.withoutInvoice')} value={roomsWithoutInvoice} />
      </div>

      {/* Status chips filter the table only; the tiles above stay whole-list totals. */}
      <div
        role="group"
        aria-label={t('billing.filterByStatus')}
        className="mb-4 flex flex-wrap items-center gap-2"
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

      <Card>
        {listedRooms.length === 0 ? (
          <div className="p-4">
            <EmptyState
              message={
                activeRooms.length === 0
                  ? t('billing.noActiveContract')
                  : t('billing.noRoomsWithStatus')
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
                <tr key={room.room_id}>
                  <TD>
                    <Link
                      href={billingHref}
                      className="text-brand-blue-deep font-semibold underline"
                    >
                      {room.room_number}
                    </Link>
                  </TD>
                  <TD>
                    <SegmentBadge segment={propertySegment(room.room_type)} />
                  </TD>
                  <TD>{room.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD>
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
