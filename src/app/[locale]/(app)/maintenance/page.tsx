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
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import { getMaintenanceReport } from '@/lib/reporting/queries';
import { filterByView, parseSegmentView } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/date';

export default async function MaintenancePage({
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
  const profile = await getCurrentProfile();
  const canWrite = can(profile?.role, 'maintenance:write');
  const [allTickets, rooms] = await Promise.all([
    getMaintenanceReport(),
    canWrite ? getRoomBoard({ includeTest: false }) : Promise.resolve([]),
  ]);
  const tickets = filterByView(view, allTickets);

  // A ticket with no room has no segment, so filtering to หอพัก or บ้านพัก
  // drops it. Say how many rather than letting the total quietly shrink.
  const commonAreaHidden =
    view === 'all' ? 0 : allTickets.filter((ticket) => ticket.property_segment === null).length;

  const open = tickets.filter((ticket) =>
    ['open', 'in_progress', 'waiting'].includes(ticket.status),
  );

  return (
    <>
      <PageHeader
        title={t('maintenance.title')}
        description={`${open.length} ${t('dashboard.openTickets')}`}
        action={<SegmentSwitcher current={view} pathname="/maintenance" />}
      />

      {canWrite ? (
        <div className="mb-6">
          <NewMaintenanceTicketForm
            rooms={rooms.map((room) => ({ room_id: room.room_id, room_number: room.room_number }))}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title={t('reports.maintenance')}
          description={
            commonAreaHidden > 0
              ? t('maintenance.commonAreaExcluded', { count: commonAreaHidden })
              : undefined
          }
        />
        {tickets.length === 0 ? (
          <div className="p-3">
            <EmptyState message={t('dashboard.noOpenTickets')} />
          </div>
        ) : (
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
                <TD>{formatDate(ticket.created_at.slice(0, 10), typedLocale)}</TD>
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
                <TD>{ticket.category}</TD>
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
                    <TD numeric>
                      {ticket.cost === null ? '-' : formatTHB(ticket.cost, typedLocale)}
                    </TD>
                  </>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
