import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { NewMaintenanceTicketForm } from '@/components/maintenance/NewMaintenanceTicketForm';
import { TicketActionCells } from '@/components/maintenance/TicketActionCells';
import { MAINTENANCE_TONE, PRIORITY_TONE } from '@/components/room/RoomMaintenanceTab';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthFilter } from '@/components/ui/MonthFilter';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import { getClosedMaintenance, getOpenMaintenance } from '@/lib/reporting/queries';
import { filterByView, filterRoomsByView, parseSegmentView } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import {
  bangkokToday,
  billingMonthOf,
  currentBillingMonth,
  formatBillingMonth,
  formatDate,
} from '@/lib/utils/date';
import {
  firstParam,
  monthQuery,
  parseMonthParams,
  type SearchParam,
} from '@/lib/utils/month-filter';
import type { MaintenanceReportRow } from '@/types/database';

/** More open tickets than this would be a building in crisis, not a list to page through. */
const OPEN_TICKET_LIMIT = 500;

/** Bangkok calendar date of a timestamp -- a late-evening ticket must not land on the day before. */
function bangkokDate(timestamp: string) {
  return bangkokToday(new Date(timestamp));
}

/** The month a ticket was closed in: when the work finished, else when it was reported. */
function closedMonth(ticket: MaintenanceReportRow) {
  return billingMonthOf(bangkokDate(ticket.completed_at ?? ticket.created_at));
}

export default async function MaintenancePage({
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
  const profile = await getCurrentProfile();
  const canWrite = can(profile?.role, 'maintenance:write');
  const [allOpen, allClosed, wholeRooms] = await Promise.all([
    getOpenMaintenance(OPEN_TICKET_LIMIT),
    getClosedMaintenance(),
    getRoomBoard({ includeTest: false }),
  ]);
  const rooms = filterRoomsByView(view, wholeRooms);
  // A room outside the current segment is ignored rather than showing an empty list.
  const roomFilter = rooms.find((room) => room.room_number === firstParam(query.room))?.room_number;
  // A common-area ticket has no room, so a room search leaves it out.
  const byRoom = (tickets: MaintenanceReportRow[]) =>
    roomFilter ? tickets.filter((ticket) => ticket.room_number === roomFilter) : tickets;

  // A ticket with no room has no segment, so filtering to หอพัก or บ้านพัก
  // drops it. Say how many rather than letting the total quietly shrink.
  const commonAreaHidden = (tickets: MaintenanceReportRow[]) =>
    view === 'all' ? 0 : tickets.filter((ticket) => ticket.property_segment === null).length;

  // Open tickets are a to-do list: every month stays listed so none is
  // missed. The month search narrows only the finished ones.
  const open = filterByView(view, allOpen);
  const listedOpen = byRoom(open);
  const closedThisMonth = allClosed.filter((ticket) => closedMonth(ticket) === month);
  const listedClosed = byRoom(filterByView(view, closedThisMonth));
  const closedCost = sumMoney(listedClosed.map((ticket) => ticket.cost ?? 0));
  const firstMonth = allClosed.map(closedMonth).reduce((a, b) => (b < a ? b : a), currentMonth);
  const monthLabel = formatBillingMonth(month, typedLocale);

  const ticketsTable = (tickets: MaintenanceReportRow[]) => (
    <Table
      head={
        <tr>
          <TH>{t('maintenance.reportedAt')}</TH>
          <TH>{t('room.roomNumber')}</TH>
          <TH>{t('segment.column')}</TH>
          <TH>{t('maintenance.category')}</TH>
          <TH>{t('maintenance.description')}</TH>
          <TH>{t('maintenance.priority')}</TH>
          <TH>{t('common.status')}</TH>
          <TH>{t('maintenance.technician')}</TH>
          <TH numeric>{t('maintenance.cost')}</TH>
          {canWrite ? <TH>{t('common.actions')}</TH> : null}
        </tr>
      }
    >
      {tickets.map((ticket) => (
        <tr key={ticket.ticket_id}>
          <TD>{formatDate(bangkokDate(ticket.created_at), typedLocale)}</TD>
          <TD>
            {ticket.room_id ? (
              <Link
                href={`/rooms/${ticket.room_id}`}
                className="text-brand-blue-deep font-medium underline"
              >
                {ticket.room_number}
              </Link>
            ) : (
              <span className="text-ink-subtle">{t('maintenance.commonArea')}</span>
            )}
          </TD>
          <TD>
            <SegmentBadge segment={ticket.property_segment} />
          </TD>
          <TD>{t(`maintenanceCategory.${ticket.category}`)}</TD>
          <TD className="max-w-sm">{ticket.description}</TD>
          <TD>
            <Badge tone={PRIORITY_TONE[ticket.priority]}>
              {t(`maintenancePriority.${ticket.priority}`)}
            </Badge>
          </TD>
          {canWrite ? (
            <TicketActionCells
              ticketId={ticket.ticket_id}
              roomId={ticket.room_id}
              status={ticket.status}
              technician={ticket.technician}
              cost={ticket.cost}
            />
          ) : (
            <>
              <TD>
                <Badge tone={MAINTENANCE_TONE[ticket.status]}>
                  {t(`maintenanceStatus.${ticket.status}`)}
                </Badge>
              </TD>
              <TD>{ticket.technician ?? '-'}</TD>
              <TD numeric>{ticket.cost === null ? '-' : formatTHB(ticket.cost, typedLocale)}</TD>
            </>
          )}
        </tr>
      ))}
    </Table>
  );

  const hiddenNote = (tickets: MaintenanceReportRow[]) => {
    const hidden = commonAreaHidden(tickets);
    return hidden > 0 ? t('maintenance.commonAreaExcluded', { count: hidden }) : undefined;
  };

  return (
    <>
      <PageHeader
        title={t('maintenance.title')}
        description={`${open.length} ${t('dashboard.openTickets')}`}
        action={
          <SegmentSwitcher
            current={view}
            pathname="/maintenance"
            query={monthQuery(month, currentMonth, { room: roomFilter })}
          />
        }
      />

      {canWrite ? (
        <div className="mb-6">
          <NewMaintenanceTicketForm
            rooms={wholeRooms.map((room) => ({
              room_id: room.room_id,
              room_number: room.room_number,
            }))}
          />
        </div>
      ) : null}

      <div className="space-y-4">
        <Card>
          <MonthFilter
            label={t('maintenance.filterLabel')}
            pathname="/maintenance"
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
          <CardHeader title={t('maintenance.openTitle')} description={hiddenNote(allOpen)} />
          {listedOpen.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noOpenTickets')} />
            </div>
          ) : (
            ticketsTable(listedOpen)
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('maintenance.closedFor', { month: monthLabel })}
            description={hiddenNote(closedThisMonth)}
            action={
              listedClosed.length > 0 ? (
                <span className="text-ink font-display text-h4 font-semibold tabular-nums">
                  {t('maintenance.closedCost', { amount: formatTHB(closedCost, typedLocale) })}
                </span>
              ) : undefined
            }
          />
          {listedClosed.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('maintenance.noClosedInMonth', { month: monthLabel })} />
            </div>
          ) : (
            ticketsTable(listedClosed)
          )}
        </Card>
      </div>
    </>
  );
}
