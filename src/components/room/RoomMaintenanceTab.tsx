import { useTranslations } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { RoomDetail } from '@/lib/rooms/queries';
import { formatDate } from '@/lib/utils/date';
import type { MaintenancePriority, MaintenanceStatus } from '@/types/database';

export const PRIORITY_TONE: Record<MaintenancePriority, BadgeTone> = {
  low: 'neutral',
  medium: 'blue',
  high: 'yellow',
  urgent: 'red',
};

export const MAINTENANCE_TONE: Record<MaintenanceStatus, BadgeTone> = {
  open: 'yellow',
  in_progress: 'blue',
  waiting: 'neutral',
  completed: 'green',
  cancelled: 'neutral',
};

export function RoomMaintenanceTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = useTranslations();

  if (detail.tickets.length === 0) {
    return <EmptyState message={t('room.noMaintenance')} />;
  }

  return (
    <Card>
      <CardHeader title={t('maintenance.title')} />
      <Table
        head={
          <tr>
            <TH>{t('maintenance.reportedAt')}</TH>
            <TH>{t('maintenance.category')}</TH>
            <TH>{t('maintenance.description')}</TH>
            <TH>{t('maintenance.priority')}</TH>
            <TH>{t('common.status')}</TH>
            <TH>{t('maintenance.technician')}</TH>
            <TH numeric>{t('maintenance.cost')}</TH>
          </tr>
        }
      >
        {detail.tickets.map((ticket) => (
          <tr key={ticket.id}>
            <TD>{formatDate(ticket.created_at.slice(0, 10), locale)}</TD>
            <TD>{ticket.category}</TD>
            <TD className="max-w-xs">{ticket.description}</TD>
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
            <TD>{ticket.technician ?? t('common.notAvailable')}</TD>
            <TD numeric>{ticket.cost === null ? '-' : formatTHB(ticket.cost, locale)}</TD>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
