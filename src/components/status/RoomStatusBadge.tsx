import {
  CalendarClock,
  CircleCheck,
  Clock,
  DoorOpen,
  TriangleAlert,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { FinancialStatus, RoomStatus } from '@/types/database';

import {
  STATUS_STYLES,
  toDisplayStatus,
  type RoomDisplayStatus,
  type StatusIconName,
} from './status-styles';

export const STATUS_ICONS: Record<StatusIconName, LucideIcon> = {
  DoorOpen,
  CalendarClock,
  Wrench,
  User,
  CircleCheck,
  Clock,
  TriangleAlert,
};

const TONE_BY_STATUS: Record<RoomDisplayStatus, BadgeTone> = {
  vacant: 'neutral',
  reserved: 'blue',
  maintenance: 'neutral',
  occupied_no_bill: 'blue',
  occupied_paid: 'green',
  occupied_due: 'yellow',
  occupied_overdue: 'red',
};

/**
 * Room status as colour + icon + text, never colour alone.
 * Works in both Server and Client Components.
 */
export function RoomStatusBadge({
  roomStatus,
  financialStatus,
  className,
}: {
  roomStatus: RoomStatus;
  financialStatus: FinancialStatus;
  className?: string;
}) {
  const t = useTranslations('combinedStatus');
  const displayStatus = toDisplayStatus(roomStatus, financialStatus);
  const style = STATUS_STYLES[displayStatus];
  const Icon = STATUS_ICONS[style.icon];

  return (
    <Badge
      tone={TONE_BY_STATUS[displayStatus]}
      icon={<Icon size={12} aria-hidden="true" />}
      className={className}
    >
      {t(style.labelKey)}
    </Badge>
  );
}
