'use client';

import { useTranslations } from 'next-intl';

import { STATUS_ICONS } from '@/components/status/RoomStatusBadge';
import { STATUS_STYLES, toDisplayStatus } from '@/components/status/status-styles';
import type { FloorLayout } from '@/config/floor-layout';
import { formatAmount } from '@/lib/billing/money';
import { cn } from '@/lib/utils/cn';
import type { RoomBoardRow } from '@/types/database';

import type { Locale } from '@/i18n/routing';

const DECORATION_FILL: Record<string, string> = {
  corridor: 'fill-surface-sunken',
  stairs: 'fill-surface-sunken',
  entrance: 'fill-brand-blue',
  lift: 'fill-surface-sunken',
};

/** SVG has no text overflow; trim so long Thai names cannot escape the room. */
function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function FloorPlanSvg({
  layout,
  roomsByNumber,
  selectedRoomNumber,
  onSelectRoom,
  locale,
}: {
  layout: FloorLayout;
  roomsByNumber: Map<string, RoomBoardRow>;
  selectedRoomNumber: string | null;
  onSelectRoom: (roomNumber: string) => void;
  locale: Locale;
}) {
  const t = useTranslations();

  return (
    <svg
      viewBox={layout.viewBox}
      role="group"
      aria-label={t('floorPlan.floor', { floor: layout.floor })}
      className="block h-full max-h-full w-full max-w-full select-none"
    >
      <defs>
        {/* Hatch for maintenance, so the status survives without colour. */}
        <pattern
          id="hatch-maintenance"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            className="stroke-status-maintenance-edge"
            strokeWidth="2"
          />
        </pattern>
      </defs>

      {/* Building footprint. */}
      <polygon
        points={layout.outline.map(([x, y]) => `${x},${y}`).join(' ')}
        className="fill-surface"
      />

      {layout.decorations.map((decoration, index) => (
        <g key={`${decoration.type}-${index}`}>
          <rect
            x={decoration.x}
            y={decoration.y}
            width={decoration.width}
            height={decoration.height}
            className={cn(DECORATION_FILL[decoration.type] ?? 'fill-surface-sunken')}
            rx={decoration.type === 'entrance' ? 3 : 0}
          />
          {decoration.type === 'stairs' ? (
            <text
              x={decoration.x + decoration.width / 2}
              y={decoration.y + decoration.height / 2 + 4}
              textAnchor="middle"
              className="fill-ink-subtle text-[11px]"
            >
              {t('floorPlan.stairs')}
            </text>
          ) : null}
        </g>
      ))}

      {layout.rooms.map((roomLayout) => {
        const room = roomsByNumber.get(roomLayout.roomNumber);

        // A layout entry with no database row means the seed and the layout have
        // drifted. Draw it as an outline rather than silently hiding the room.
        if (!room) {
          return (
            <g key={roomLayout.roomNumber}>
              <rect
                x={roomLayout.x}
                y={roomLayout.y}
                width={roomLayout.width}
                height={roomLayout.height}
                className="fill-surface-sunken stroke-border-strong"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text
                x={roomLayout.x + roomLayout.width / 2}
                y={roomLayout.y + roomLayout.height / 2}
                textAnchor="middle"
                className="fill-ink-subtle text-[13px] font-semibold"
              >
                {roomLayout.roomNumber}
              </text>
            </g>
          );
        }

        const displayStatus = toDisplayStatus(room.room_status, room.financial_status);
        const style = STATUS_STYLES[displayStatus];
        const Icon = STATUS_ICONS[style.icon];
        const isSelected = selectedRoomNumber === roomLayout.roomNumber;

        const statusLabel = t(`combinedStatus.${style.labelKey}`);
        const tenantLabel = room.tenant_name ?? t('room.noTenant');
        const ariaLabel = [
          t('room.title', { roomNumber: room.room_number }),
          statusLabel,
          room.tenant_name ?? '',
          room.outstanding > 0 ? `${t('billing.outstanding')} ${room.outstanding}` : '',
        ]
          .filter(Boolean)
          .join('. ');

        const centreX = roomLayout.x + roomLayout.width / 2;

        return (
          <g
            key={roomLayout.roomNumber}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-pressed={isSelected}
            onClick={() => onSelectRoom(roomLayout.roomNumber)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectRoom(roomLayout.roomNumber);
              }
            }}
            transform={
              roomLayout.rotation
                ? `rotate(${roomLayout.rotation} ${centreX} ${roomLayout.y + roomLayout.height / 2})`
                : undefined
            }
            className="cursor-pointer outline-offset-2"
          >
            <rect
              x={roomLayout.x}
              y={roomLayout.y}
              width={roomLayout.width}
              height={roomLayout.height}
              rx="3"
              className={cn(style.fill, style.stroke, 'transition-[stroke-width]')}
              strokeWidth={isSelected ? 4 : 1.5}
            />

            {style.hatched ? (
              <rect
                x={roomLayout.x}
                y={roomLayout.y}
                width={roomLayout.width}
                height={roomLayout.height}
                rx="3"
                fill="url(#hatch-maintenance)"
                opacity="0.25"
                pointerEvents="none"
              />
            ) : null}

            <text
              x={roomLayout.x + 10}
              y={roomLayout.y + 26}
              className={cn(style.text, 'text-[15px] font-bold')}
            >
              {room.room_number}
            </text>

            {/* Nested svg lets the Lucide icon sit inside the room rectangle. */}
            <Icon
              x={roomLayout.x + roomLayout.width - 28}
              y={roomLayout.y + 10}
              width={16}
              height={16}
              className={cn(style.text, 'stroke-current')}
              aria-hidden="true"
            />

            <text
              x={roomLayout.x + 10}
              y={roomLayout.y + 46}
              className={cn(style.text, 'text-[8px] font-medium')}
            >
              {truncate(statusLabel, 26)}
            </text>

            <text x={roomLayout.x + 10} y={roomLayout.y + 68} className="fill-ink-muted text-[8px]">
              {truncate(tenantLabel, 22)}
            </text>

            {room.occupant_count ? (
              <text
                x={roomLayout.x + 10}
                y={roomLayout.y + 84}
                className="fill-ink-subtle text-[8px]"
              >
                {t('room.occupantsValue', { count: room.occupant_count })}
              </text>
            ) : null}

            {room.outstanding > 0 ? (
              <text
                x={roomLayout.x + roomLayout.width - 10}
                y={roomLayout.y + roomLayout.height - 10}
                textAnchor="end"
                className={cn(style.text, 'text-[9px] font-semibold tabular-nums')}
              >
                {formatAmount(room.outstanding, locale)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
