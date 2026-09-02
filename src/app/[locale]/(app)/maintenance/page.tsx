import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { MAINTENANCE_TONE, PRIORITY_TONE } from '@/components/room/RoomMaintenanceTab';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { getMaintenanceReport } from '@/lib/reporting/queries';
import { formatDate } from '@/lib/utils/date';

export default async function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const tickets = await getMaintenanceReport();

  const open = tickets.filter((ticket) =>
    ['open', 'in_progress', 'waiting'].includes(ticket.status),
  );

  return (
    <>
      <PageHeader
        title={t('maintenance.title')}
        description={`${open.length} ${t('dashboard.openTickets')}`}
      />

      <div className="mb-6">
        <ComingSoon>{t('maintenance.newTicket')}</ComingSoon>
      </div>

      <Card>
        <CardHeader title={t('reports.maintenance')} />
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
                <TH>{t('maintenance.category')}</TH>
                <TH>{t('maintenance.description')}</TH>
                <TH>{t('maintenance.priority')}</TH>
                <TH>{t('common.status')}</TH>
                <TH>{t('maintenance.technician')}</TH>
                <TH numeric>{t('maintenance.cost')}</TH>
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
                <TD>{ticket.category}</TD>
                <TD className="max-w-sm">{ticket.description}</TD>
                <TD>
                  <Badge tone={PRIORITY_TONE[ticket.priority]}>
                    {t(`maintenancePriority.${ticket.priority}`)}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={MAINTENANCE_TONE[ticket.status]}>
                    {t(`maintenanceStatus.${ticket.status}`)}
                  </Badge>
                </TD>
                <TD>{ticket.technician ?? '-'}</TD>
                <TD numeric>{ticket.cost === null ? '-' : formatTHB(ticket.cost, typedLocale)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
