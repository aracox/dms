import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { STATUS_ICONS } from '@/components/status/RoomStatusBadge';
import {
  LEGEND_ORDER,
  STATUS_STYLES,
  toDisplayStatus,
  type RoomDisplayStatus,
} from '@/components/status/status-styles';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { groupRoomStatus, type RoomStatusRow } from '@/lib/reporting/room-status';
import { cn } from '@/lib/utils/cn';

/**
 * Every room at a glance, one row per floor plus the houses. It shares the
 * floor plan's status styles and labels, so a room reads the same in both
 * places; each tile links to its room detail.
 */
export function RoomStatusMap({
  rooms,
  noticeRoomIds,
}: {
  rooms: readonly RoomStatusRow[];
  /** Rooms whose tenant has given move-out notice (report_move_out_notices). */
  noticeRoomIds: ReadonlySet<string>;
}) {
  const t = useTranslations();
  const displayStatusOf = (room: RoomStatusRow) =>
    toDisplayStatus(room.room_status, room.financial_status, noticeRoomIds.has(room.room_id));
  const groups = groupRoomStatus(rooms);
  const present = new Set<RoomDisplayStatus>(rooms.map(displayStatusOf));

  return (
    <Card>
      <CardHeader
        title={t('dashboard.roomStatus')}
        action={
          <Link
            href="/floor-plan"
            className="text-brand-blue-deep text-caption inline-flex items-center gap-1 font-medium hover:underline"
          >
            {t('nav.floorPlan')}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        }
      />
      <CardBody className="flex flex-col gap-3">
        {groups.map((group) => (
          <div
            key={group.kind === 'floor' ? `floor-${group.floor}` : 'house'}
            className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
          >
            <h3 className="text-ink-muted text-caption shrink-0 font-medium sm:w-16 sm:pt-2.5">
              {group.kind === 'floor'
                ? t('floorPlan.floor', { floor: group.floor })
                : t('segment.house')}
            </h3>
            <ul className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
              {group.rooms.map((room) => {
                const style = STATUS_STYLES[displayStatusOf(room)];
                const Icon = STATUS_ICONS[style.icon];
                return (
                  <li key={room.room_id}>
                    <Link
                      href={`/rooms/${room.room_id}`}
                      className={cn(
                        'flex min-w-0 flex-col rounded-md border px-2.5 py-1.5 transition-shadow hover:shadow-md',
                        style.badge,
                        style.hatched &&
                          'bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.05)_6px_8px)]',
                      )}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span className="font-display text-body-sm font-semibold">
                          {room.room_number}
                        </span>
                        <Icon size={13} aria-hidden="true" className="shrink-0" />
                      </span>
                      <span className="truncate text-[11px]">
                        {t(`combinedStatus.${style.labelKey}`)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <ul
          aria-label={t('floorPlan.legend')}
          className="border-border flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3"
        >
          {LEGEND_ORDER.filter((status) => present.has(status)).map((status) => {
            const style = STATUS_STYLES[status];
            const Icon = STATUS_ICONS[style.icon];
            return (
              <li key={status} className="text-ink-muted text-caption flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-sm border',
                    style.swatch,
                  )}
                >
                  <Icon size={9} aria-hidden="true" />
                </span>
                {t(`combinedStatus.${style.labelKey}`)}
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
