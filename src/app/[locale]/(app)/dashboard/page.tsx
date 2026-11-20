import {
  CalendarClock,
  Check,
  CreditCard,
  DoorOpen,
  FileWarning,
  Gauge,
  LogOut,
  Plus,
  ScrollText,
  TrendingUp,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { BusinessOverviewCharts } from '@/components/dashboard/BusinessOverviewCharts';
import { RoomStatusMap } from '@/components/dashboard/RoomStatusMap';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { MAINTENANCE_TONE, PRIORITY_TONE } from '@/components/room/RoomMaintenanceTab';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB, round2, sumMoney } from '@/lib/billing/money';
import { summarizeBusinessOverview } from '@/lib/reporting/business-overview';
import { getDashboardData } from '@/lib/reporting/queries';
import {
  filterByView,
  forView,
  parseSegmentView,
  PROPERTY_SEGMENTS,
} from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import { formatBillingMonth, formatDate } from '@/lib/utils/date';
import type { FinanceSummaryRow } from '@/types/database';

type AttentionTone = 'red' | 'yellow' | 'neutral';

/** Row fill, edge and icon ink per tone. The row's text always states the issue. */
const ATTENTION_TONE: Record<AttentionTone, { row: string; hover: string; icon: string }> = {
  red: {
    row: 'bg-brand-red-soft border-brand-red/25',
    hover: 'hover:border-brand-red/60',
    icon: 'text-brand-red-deep',
  },
  yellow: {
    row: 'bg-brand-yellow-soft border-brand-yellow/35',
    hover: 'hover:border-brand-yellow/80',
    icon: 'text-brand-yellow-deep',
  },
  neutral: {
    row: 'bg-surface-muted border-border',
    hover: 'hover:border-border-strong',
    icon: 'text-ink-muted',
  },
};

interface AttentionItem {
  key: string;
  tone: AttentionTone;
  icon: LucideIcon;
  room: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  amount?: string;
  /** Where clicking the row itself goes: the room, when the item has one. */
  detailHref: string;
  /** The next step, shown as the row's button. */
  href: string;
  action: string;
}

/** Display-only share of the month's billing collected so far, one decimal. */
function collectionRate(finance: FinanceSummaryRow) {
  if (finance.invoiced_total <= 0) return 0;
  return Math.round((finance.collected_this_month * 1000) / finance.invoiced_total) / 10;
}

/**
 * Every figure on this page comes from `lib/reporting`, which reads only the
 * report_* views. The T01 test room cannot appear here.
 */
export default async function DashboardPage({
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
  const {
    rooms: wholeRooms,
    roomsBySegment,
    finance: wholeFinance,
    financeBySegment,
    overview,
    overviewBySegment,
    tenants: wholeTenants,
    tenantsBySegment,
    expiring: allExpiring,
    moveOutNotices: allMoveOutNotices,
    maintenance: allMaintenance,
    lostCards: allLostCards,
    overdue: allOverdue,
    roomStatus: allRoomStatus,
    depositsHeld: allDepositsHeld,
  } = await getDashboardData();

  // Everything below reads the selected view -- the combined figures, or one
  // segment's own. The report_* views already dropped T01 from both, so
  // narrowing here cannot let test data back in.
  const rooms = forView(view, wholeRooms, roomsBySegment);
  const finance = forView(view, wholeFinance, financeBySegment);
  const tenants = forView(view, wholeTenants, tenantsBySegment);
  const expiring = filterByView(view, allExpiring);
  const moveOutNotices = filterByView(view, allMoveOutNotices);
  const maintenance = filterByView(view, allMaintenance);
  const lostCards = filterByView(view, allLostCards);
  const overdue = filterByView(view, allOverdue);
  const depositsHeld = sumMoney(filterByView(view, allDepositsHeld).map((row) => row.deposit));
  const roomStatus = filterByView(view, allRoomStatus);

  const money = (amount: number) => formatTHB(amount, typedLocale);
  const rate = collectionRate(finance);

  const segmentOccupancy = overviewBySegment.filter((row) => row.segment === view);
  const averageOccupancy =
    view === 'all'
      ? summarizeBusinessOverview(overview).averageOccupancy
      : segmentOccupancy.length === 0
        ? 0
        : round2(
            segmentOccupancy.reduce((sum, row) => sum + row.occupancy_rate, 0) /
              segmentOccupancy.length,
          );

  const attention: AttentionItem[] = [
    ...overdue.map((invoice): AttentionItem => ({
      key: `invoice-${invoice.invoice_id}`,
      tone: 'red',
      icon: TriangleAlert,
      room: invoice.room_number,
      title: invoice.tenant_name ?? t('common.notAvailable'),
      meta: (
        <>
          {t('billing.dueDate')} {formatDate(invoice.due_date, typedLocale)}
          <Badge tone="red" className="ml-1.5">
            {t('dashboard.daysOverdue', { days: invoice.days_overdue })}
          </Badge>
        </>
      ),
      amount: money(invoice.outstanding),
      detailHref: `/rooms/${invoice.room_id}`,
      href: '/payments',
      action: t('payments.recordPayment'),
    })),
    ...maintenance.map((ticket): AttentionItem => ({
      key: `ticket-${ticket.ticket_id}`,
      tone: 'yellow',
      icon: Wrench,
      room: ticket.room_number ?? t('maintenance.commonArea'),
      title: ticket.description || ticket.category,
      meta: (
        <>
          {ticket.category}
          <Badge tone={MAINTENANCE_TONE[ticket.status]} className="ml-1.5">
            {t(`maintenanceStatus.${ticket.status}`)}
          </Badge>
          <Badge tone={PRIORITY_TONE[ticket.priority]} className="ml-1.5">
            {t(`maintenancePriority.${ticket.priority}`)}
          </Badge>
        </>
      ),
      detailHref: ticket.room_id ? `/rooms/${ticket.room_id}` : '/maintenance',
      href: '/maintenance',
      action: t('common.viewDetails'),
    })),
    ...expiring.map((contract): AttentionItem => ({
      key: `contract-${contract.contract_id}`,
      tone: contract.days_remaining <= 30 ? 'yellow' : 'neutral',
      icon: ScrollText,
      room: contract.room_number,
      title: contract.tenant_name,
      meta: (
        <>
          {t('dashboard.contractsExpiring')} · {formatDate(contract.end_date, typedLocale)}
          <Badge tone={contract.days_remaining <= 30 ? 'yellow' : 'neutral'} className="ml-1.5">
            {contract.days_remaining < 0
              ? t('dashboard.expired')
              : contract.days_remaining === 0
                ? t('dashboard.expiresToday')
                : t('dashboard.daysRemaining', { days: contract.days_remaining })}
          </Badge>
        </>
      ),
      detailHref: `/rooms/${contract.room_id}`,
      href: `/rooms/${contract.room_id}`,
      action: t('common.viewDetails'),
    })),
    ...moveOutNotices.map((notice): AttentionItem => ({
      key: `move-out-${notice.contract_id}`,
      tone: notice.days_remaining <= 7 ? 'yellow' : 'neutral',
      icon: LogOut,
      room: notice.room_number,
      title: notice.tenant_name,
      meta: (
        <>
          {t('dashboard.moveOutNotices')} · {formatDate(notice.planned_move_out_date, typedLocale)}
          <Badge tone={notice.days_remaining <= 7 ? 'yellow' : 'neutral'} className="ml-1.5">
            {notice.days_remaining <= 0
              ? t('dashboard.leavingToday')
              : t('dashboard.daysRemaining', { days: notice.days_remaining })}
          </Badge>
        </>
      ),
      detailHref: `/rooms/${notice.room_id}`,
      href: `/rooms/${notice.room_id}`,
      action: t('common.viewDetails'),
    })),
    ...lostCards.map((card): AttentionItem => ({
      key: `card-${card.card_id}`,
      tone: 'neutral',
      icon: CreditCard,
      room: card.card_number,
      title: t('dashboard.lostCards'),
      meta: `${t('cards.replacementFee')} ${money(card.replacement_fee)}`,
      detailHref: `/rooms/${card.room_id}`,
      href: '/access-cards',
      action: t('common.viewDetails'),
    })),
  ];

  // The categories with nothing pending, so an empty list still says what was checked.
  const allClear = [
    overdue.length === 0 && t('dashboard.noOverdue'),
    maintenance.length === 0 && t('dashboard.noOpenTickets'),
    expiring.length === 0 && t('dashboard.noExpiringContracts'),
    moveOutNotices.length === 0 && t('dashboard.noMoveOutNotices'),
    lostCards.length === 0 && t('dashboard.noLostCards'),
  ].filter((message): message is string => Boolean(message));

  const balanceNote =
    finance.outstanding <= 0
      ? t('dashboard.fullyCollected')
      : finance.overdue === finance.outstanding
        ? t('dashboard.overdueAmount', { amount: money(finance.overdue) })
        : finance.overdue > 0
          ? `${t('dashboard.outstandingAmount', { amount: money(finance.outstanding) })} · ${t(
              'dashboard.overdueAmount',
              { amount: money(finance.overdue) },
            )}`
          : t('dashboard.outstandingAmount', { amount: money(finance.outstanding) });

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={
          view === 'all'
            ? t('dashboard.subtitle', {
                count: wholeRooms.total_rooms,
                dorm: roomsBySegment.dorm.total_rooms,
                house: roomsBySegment.house.total_rooms,
              })
            : t('dashboard.subtitleSegment', {
                segment: t(`segment.${view}`),
                units: t(`segment.units.${view}`, { count: rooms.total_rooms }),
              })
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentSwitcher current={view} pathname="/dashboard" />
            <Link href="/meters" className={buttonClasses('secondary')}>
              <Gauge size={15} aria-hidden="true" />
              {t('nav.meters')}
            </Link>
            <Link href="/payments" className={buttonClasses('primary')}>
              <Plus size={15} aria-hidden="true" />
              {t('payments.recordPayment')}
            </Link>
          </div>
        }
      />

      <div className="mb-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {t('dashboard.needsAttention')}
                {attention.length > 0 ? (
                  <Badge tone="red">
                    {t('dashboard.attentionCount', { count: attention.length })}
                  </Badge>
                ) : null}
              </span>
            }
          />
          <CardBody className="flex flex-col gap-3">
            {attention.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {attention.map((item) => (
                  <AttentionRow key={item.key} item={item} />
                ))}
              </ul>
            ) : null}
            {allClear.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {allClear.map((message) => (
                  <li key={message}>
                    <Badge tone="green" icon={<Check size={12} aria-hidden="true" />}>
                      {message}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>

        <section
          aria-labelledby="collection-heading"
          className="glass-surface flex flex-col gap-4 rounded-xl p-5 text-white shadow-lg [--glass-fill:var(--color-brand-blue)]"
        >
          <h2
            id="collection-heading"
            className="font-display text-body-sm font-medium text-white/80"
          >
            {t('dashboard.collectedHeading', {
              month: formatBillingMonth(finance.billing_month, typedLocale),
            })}
          </h2>
          <div>
            <p className="font-display text-[40px] leading-tight font-semibold tabular-nums">
              {money(finance.collected_this_month)}
            </p>
            <p className="text-body-sm text-white/80">
              {t('dashboard.collectedOf', { amount: money(finance.invoiced_total) })}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
              <div
                className="bg-brand-teal h-full rounded-full"
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <div className="text-caption flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{rate}%</span>
              <span
                className={cn(
                  'font-medium',
                  finance.outstanding > 0 ? 'text-brand-red-soft' : 'text-brand-green-soft',
                )}
              >
                {balanceNote}
              </span>
            </div>
          </div>

          {view === 'all' ? (
            <ul className="flex flex-col gap-2.5 border-t border-white/20 pt-4">
              {PROPERTY_SEGMENTS.map((segment) => {
                const segmentRate = collectionRate(financeBySegment[segment]);
                return (
                  <li
                    key={segment}
                    className="text-caption grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-3"
                  >
                    <span className="text-white/80">{t(`segment.${segment}`)}</span>
                    <span
                      className="h-1.5 overflow-hidden rounded-full bg-white/20"
                      aria-hidden="true"
                    >
                      <span
                        className="bg-brand-teal block h-full rounded-full"
                        style={{ width: `${Math.min(segmentRate, 100)}%` }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{segmentRate}%</span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-white/10 px-3.5 py-3">
              <span className="text-caption text-white/80">{t('dashboard.expectedRevenue')}</span>
              <span className="text-body font-semibold tabular-nums">
                {money(finance.expected_rent)}
              </span>
            </div>
            {/* Held for tenants and refunded at move-out: shown apart from income. */}
            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-white/10 px-3.5 py-3">
              <span className="text-caption text-white/80">{t('dashboard.depositsHeld')}</span>
              <span className="text-body font-semibold tabular-nums">{money(depositsHeld)}</span>
            </div>
          </div>
        </section>
      </div>

      <section
        aria-label={t('dashboard.rooms')}
        className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <StatTile
          label={t('dashboard.occupancyRate')}
          value={`${rooms.occupancy_rate}%`}
          hint={t('dashboard.averageOccupancy', { rate: averageOccupancy })}
          tone="blue"
          tinted
          icon={<TrendingUp size={14} aria-hidden="true" />}
        />
        <StatTile
          label={t('dashboard.occupied')}
          value={`${rooms.occupied} / ${rooms.total_rooms}`}
          hint={t('dashboard.occupantsHint', { count: tenants.total_occupants })}
          tone="brown"
          tinted
          icon={<Users size={14} aria-hidden="true" />}
        />
        <StatTile
          label={t('dashboard.vacant')}
          value={rooms.vacant}
          icon={<DoorOpen size={14} aria-hidden="true" />}
        />
        <StatTile
          label={t('dashboard.reserved')}
          value={rooms.reserved}
          tone="blue"
          tinted={rooms.reserved > 0}
          icon={<CalendarClock size={14} aria-hidden="true" />}
        />
        <StatTile
          label={t('dashboard.maintenance')}
          value={rooms.maintenance}
          tone="yellow"
          tinted={rooms.maintenance > 0}
          icon={<Wrench size={14} aria-hidden="true" />}
        />
      </section>

      <div className="mb-5">
        <RoomStatusMap
          rooms={roomStatus}
          noticeRoomIds={new Set(allMoveOutNotices.map((notice) => notice.room_id))}
        />
      </div>

      <section aria-labelledby="business-overview-heading" className="mb-5">
        <h2
          id="business-overview-heading"
          className="text-ink-muted font-display text-caption mb-3 font-medium"
        >
          {t('dashboard.businessOverview')}
        </h2>
        <BusinessOverviewCharts
          rows={overview}
          segmentRows={overviewBySegment}
          view={view}
          locale={typedLocale}
          labels={{
            occupancyTrend: t('dashboard.occupancyTrend'),
            occupancyHint: t('dashboard.occupancyTrendHint'),
            average: t('dashboard.average'),
            current: t('dashboard.current'),
            financialTrend: t('dashboard.financialTrend'),
            financialHint: t('dashboard.financialTrendHint'),
            billed: t('dashboard.billed'),
            collected: t('dashboard.collected'),
            expenses: t('dashboard.expensesWithRepairs'),
            collectionRate: t('dashboard.collectionRate'),
            netAfterExpenses: t('dashboard.netAfterExpenses'),
            noData: t('dashboard.noOverviewData'),
            wholeProperty: t('segment.wholeProperty'),
            buildingWide: t('segment.buildingWide'),
            segments: { dorm: t('segment.dorm'), house: t('segment.house') },
          }}
        />
      </section>

      <p className="text-ink-subtle text-caption flex items-center gap-1.5">
        <FileWarning size={13} aria-hidden="true" />
        {t('dashboard.testDataExcluded')}
      </p>
    </>
  );
}

/**
 * One pending item: what and where on the left, the next step on the right.
 *
 * The whole row is clickable through a stretched link on the title (its
 * `::after` covers the row), so there is no nested <a>; the action button sits
 * above that overlay and keeps its own destination.
 */
function AttentionRow({ item }: { item: AttentionItem }) {
  const tone = ATTENTION_TONE[item.tone];
  const Icon = item.icon;

  return (
    <li
      className={cn(
        'relative flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3',
        'transition hover:-translate-y-px hover:shadow-md motion-reduce:transform-none',
        'has-[a:focus-visible]:shadow-glow',
        tone.row,
        tone.hover,
      )}
    >
      <span
        className={cn(
          'bg-surface flex size-9 shrink-0 items-center justify-center rounded-md',
          tone.icon,
        )}
      >
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-[1_1_14rem]">
        <p className="text-body-sm text-ink truncate">
          <Link
            href={item.detailHref}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
          >
            <span className="font-display mr-2 font-semibold">{item.room}</span>
            <span className="font-medium">{item.title}</span>
          </Link>
        </p>
        <p className="text-caption text-ink-muted mt-0.5">{item.meta}</p>
      </div>
      {item.amount ? (
        <span className="text-brand-red-deep text-body font-semibold tabular-nums">
          {item.amount}
        </span>
      ) : null}
      <Link href={item.href} className={buttonClasses('secondary', 'sm', 'relative z-10')}>
        {item.action}
      </Link>
    </li>
  );
}
