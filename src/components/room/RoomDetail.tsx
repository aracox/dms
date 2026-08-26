import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/Badge';
import { Tabs, type TabDefinition } from '@/components/ui/Tabs';
import type { Locale } from '@/i18n/routing';
import type { RoomDetail as RoomDetailData } from '@/lib/rooms/queries';

import { RoomBillingTab } from './RoomBillingTab';
import { RoomCardsTab } from './RoomCardsTab';
import { RoomContractTab } from './RoomContractTab';
import { RoomMaintenanceTab } from './RoomMaintenanceTab';
import { RoomMetersTab } from './RoomMetersTab';
import { RoomOverviewTab } from './RoomOverviewTab';
import { RoomPaymentsTab } from './RoomPaymentsTab';

/**
 * The complete room interface.
 *
 * Test Mode renders THIS component for T01 -- there is no mock variant. If a
 * change is needed for the test room, parameterise here instead of forking.
 */
export function RoomDetail({
  detail,
  locale,
  today,
}: {
  detail: RoomDetailData;
  locale: Locale;
  today: string;
}) {
  const t = useTranslations();

  const openTickets = detail.tickets.filter((ticket) =>
    ['open', 'in_progress', 'waiting'].includes(ticket.status),
  ).length;
  const lostCards = detail.cards.filter((card) => card.status === 'lost').length;

  const tabs: TabDefinition[] = [
    {
      id: 'overview',
      label: t('room.tabs.overview'),
      content: <RoomOverviewTab detail={detail} locale={locale} />,
    },
    {
      id: 'contract',
      label: t('room.tabs.contract'),
      content: <RoomContractTab detail={detail} locale={locale} today={today} />,
    },
    {
      id: 'meters',
      label: t('room.tabs.meters'),
      content: <RoomMetersTab detail={detail} locale={locale} />,
    },
    {
      id: 'billing',
      label: t('room.tabs.billing'),
      content: <RoomBillingTab detail={detail} locale={locale} />,
    },
    {
      id: 'payments',
      label: t('room.tabs.payments'),
      content: <RoomPaymentsTab detail={detail} locale={locale} />,
    },
    {
      id: 'cards',
      label: t('room.tabs.cards'),
      badge: lostCards > 0 ? <Badge tone="red">{lostCards}</Badge> : undefined,
      content: <RoomCardsTab detail={detail} locale={locale} />,
    },
    {
      id: 'maintenance',
      label: t('room.tabs.maintenance'),
      badge: openTickets > 0 ? <Badge tone="yellow">{openTickets}</Badge> : undefined,
      content: <RoomMaintenanceTab detail={detail} locale={locale} />,
    },
  ];

  return <Tabs tabs={tabs} />;
}
