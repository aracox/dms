'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';

import { STATUS_ICONS } from '@/components/status/RoomStatusBadge';
import { STATUS_STYLES, toDisplayStatus } from '@/components/status/status-styles';
import { contentViewBox, type Decoration, type FloorLayout } from '@/config/floor-layout';
import type { Locale } from '@/i18n/routing';
import { formatAmount } from '@/lib/billing/money';
import { propertySegment } from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import { truncateVisible } from '@/lib/utils/truncate';
import type { RoomBoardRow } from '@/types/database';

/**
 * Each room is drawn inset from its layout box by this much on every side.
 * The JSON packs rooms wall to wall; the inset turns them into separate cards
 * with a gap between, without touching the geometry.
 */
const INSET = 3;

/** Corridor and stairs, drawn light so the rooms carry the plan. */
function DecorationShape({ decoration, label }: { decoration: Decoration; label: string }) {
  const { x, y, width, height, type } = decoration;
  const horizontal = width >= height;
  const box = {
    x: x + INSET,
    y: y + INSET,
    width: width - INSET * 2,
    height: height - INSET * 2,
  };
  const cx = x + width / 2;
  const cy = y + height / 2;

  if (type === 'entrance') {
    return <rect {...box} rx={4} className="fill-brand-blue" />;
  }

  return (
    <g>
      {/* No fill class on the stairs: a CSS fill would override the pattern. */}
      {type === 'stairs' ? (
        <rect {...box} rx={6} fill="url(#stairs-stripes)" />
      ) : (
        <rect {...box} rx={6} className="fill-surface-sunken" />
      )}
      {type === 'corridor' ? (
        <line
          x1={horizontal ? box.x + 12 : cx}
          y1={horizontal ? cy : box.y + 12}
          x2={horizontal ? box.x + box.width - 12 : cx}
          y2={horizontal ? cy : box.y + box.height - 12}
          strokeWidth={1.2}
          strokeDasharray="5 4"
          className="stroke-border-strong"
        />
      ) : null}
      {label ? (
        // A thick stroke in the floor colour, painted under the glyphs, breaks
        // the dashed centre line behind the label.
        <text
          x={cx}
          y={cy + 3.5}
          textAnchor="middle"
          className="fill-ink-subtle stroke-surface-sunken text-[10px] font-medium tracking-wide [paint-order:stroke]"
          strokeWidth={6}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function FloorPlanSvg({
  layout,
  roomsByNumber,
  dimmed,
  selectedRoomNumber,
  onSelectRoom,
  locale,
}: {
  layout: FloorLayout;
  roomsByNumber: Map<string, RoomBoardRow>;
  /** Room numbers the segment filter excludes: drawn faded and inert. */
  dimmed: Set<string>;
  selectedRoomNumber: string | null;
  onSelectRoom: (roomNumber: string) => void;
  locale: Locale;
}) {
  const t = useTranslations();

  const decorationLabel: Record<string, string> = {
    corridor: t('floorPlan.corridor'),
    stairs: t('floorPlan.stairs'),
    lift: t('floorPlan.lift'),
    entrance: '',
  };

  // The selected room is drawn last so its heavier stroke and glow sit above
  // its neighbours. sort() is stable, so every other room keeps its order.
  const orderedRooms = selectedRoomNumber
    ? [...layout.rooms].sort(
        (a, b) =>
          Number(a.roomNumber === selectedRoomNumber) - Number(b.roomNumber === selectedRoomNumber),
      )
    : layout.rooms;

  // Houses have no floor of their own and sit outside the building outline,
  // so they get their own labelled, dashed group.
  const houseLayouts = layout.rooms.filter((roomLayout) => {
    const room = roomsByNumber.get(roomLayout.roomNumber);
    return room ? propertySegment(room.room_type) === 'house' : false;
  });
  const houseBounds =
    houseLayouts.length > 0
      ? {
          x: Math.min(...houseLayouts.map((r) => r.x)) - 4,
          y: Math.min(...houseLayouts.map((r) => r.y)) - 4,
          right: Math.max(...houseLayouts.map((r) => r.x + r.width)) + 4,
          bottom: Math.max(...houseLayouts.map((r) => r.y + r.height)) + 4,
        }
      : null;
  const housesDimmed = houseLayouts.every((r) => dimmed.has(r.roomNumber));

  return (
    <svg
      viewBox={contentViewBox(layout)}
      role="group"
      aria-label={t('floorPlan.floor', { floor: layout.floor })}
      className="mx-auto block h-full max-h-full w-full max-w-5xl select-none"
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
        {/* Treads for the stairs. */}
        <pattern id="stairs-stripes" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" className="fill-surface-sunken" />
          <line x1="0" y1="0" x2="0" y2="7" className="stroke-border" strokeWidth="2.5" />
        </pattern>
      </defs>

      {/* Building footprint: a framed slab the rooms sit on. */}
      <polygon
        points={layout.outline.map(([x, y]) => `${x},${y}`).join(' ')}
        className="fill-surface-muted stroke-border-strong"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {layout.decorations.map((decoration, index) => (
        <DecorationShape
          key={`${decoration.type}-${index}`}
          decoration={decoration}
          label={decorationLabel[decoration.type] ?? ''}
        />
      ))}

      {houseBounds ? (
        <g className={cn('transition-opacity', housesDimmed && 'opacity-20')} aria-hidden="true">
          <rect
            x={houseBounds.x}
            y={houseBounds.y}
            width={houseBounds.right - houseBounds.x}
            height={houseBounds.bottom - houseBounds.y}
            rx={10}
            fill="none"
            strokeWidth={1.2}
            strokeDasharray="5 4"
            className="stroke-border-strong"
          />
          <text
            x={houseBounds.x + 2}
            y={houseBounds.y - 8}
            className="fill-ink-muted text-[11px] font-semibold"
          >
            {t('segment.house')}
          </text>
        </g>
      ) : null}

      {orderedRooms.map((roomLayout) => {
        const room = roomsByNumber.get(roomLayout.roomNumber);
        const box = {
          x: roomLayout.x + INSET,
          y: roomLayout.y + INSET,
          width: roomLayout.width - INSET * 2,
          height: roomLayout.height - INSET * 2,
        };

        // A layout entry with no database row means the seed and the layout have
        // drifted. Draw it as an outline rather than silently hiding the room.
        if (!room) {
          return (
            <g key={roomLayout.roomNumber}>
              <rect
                {...box}
                rx={7}
                className="fill-surface-sunken stroke-border-strong"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text
                x={box.x + box.width / 2}
                y={box.y + box.height / 2}
                textAnchor="middle"
                className="fill-ink-subtle text-[13px] font-semibold"
              >
                {roomLayout.roomNumber}
              </text>
            </g>
          );
        }

        const displayStatus = toDisplayStatus(
          room.room_status,
          room.financial_status,
          Boolean(room.notice_given_at),
        );
        const style = STATUS_STYLES[displayStatus];
        const Icon = STATUS_ICONS[style.icon];
        const isSelected = selectedRoomNumber === roomLayout.roomNumber;

        const statusLabel = t(`combinedStatus.${style.labelKey}`);
        const ariaLabel = [
          t('room.title', { roomNumber: room.room_number }),
          statusLabel,
          room.tenant_name ?? '',
          room.outstanding > 0
            ? `${t('billing.outstanding')} ${formatAmount(room.outstanding, locale)}`
            : '',
        ]
          .filter(Boolean)
          .join('. ');

        const centreX = roomLayout.x + roomLayout.width / 2;
        const isDimmed = dimmed.has(roomLayout.roomNumber);
        const bottom = box.y + box.height;

        return (
          <g
            key={roomLayout.roomNumber}
            // A unit the segment filter excludes keeps its place on the plan but
            // stops being a control: not clickable, not focusable, and hidden
            // from screen readers, which read the page's count instead.
            {...(isDimmed
              ? { 'aria-hidden': true }
              : {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': ariaLabel,
                  'aria-pressed': isSelected,
                  onClick: () => onSelectRoom(roomLayout.roomNumber),
                  onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectRoom(roomLayout.roomNumber);
                    }
                  },
                })}
            transform={
              roomLayout.rotation
                ? `rotate(${roomLayout.rotation} ${centreX} ${roomLayout.y + roomLayout.height / 2})`
                : undefined
            }
            className={cn(
              'group transition-opacity',
              isDimmed ? 'pointer-events-none opacity-20' : 'cursor-pointer',
            )}
          >
            <rect
              {...box}
              rx={7}
              className={cn(
                style.fill,
                style.stroke,
                'transition-[stroke-width,filter]',
                // Hover thickens the edge and lifts the shadow. Not a translate:
                // a CSS transform would replace the group's rotate() attribute.
                // A selected room keeps its heavier edge and glow.
                isSelected ? 'drop-shadow-lg' : !isDimmed && 'group-hover:drop-shadow-md',
                !isDimmed && !isSelected && 'group-hover:[stroke-width:2.5]',
              )}
              strokeWidth={isSelected ? 3.5 : 1.2}
              strokeDasharray={displayStatus === 'vacant' ? '5 3' : undefined}
            />

            {style.hatched ? (
              <rect
                {...box}
                rx={7}
                fill="url(#hatch-maintenance)"
                opacity="0.25"
                pointerEvents="none"
              />
            ) : null}

            {/*
              Keyboard focus ring, drawn here rather than left to CSS `outline`,
              which would wrap the group's whole bounding box and spill over the
              neighbouring room. Inset so it hugs the card. globals.css
              suppresses the CSS outline for these groups.
            */}
            <rect
              x={box.x + 3}
              y={box.y + 3}
              width={box.width - 6}
              height={box.height - 6}
              rx={5}
              fill="none"
              strokeWidth="2"
              pointerEvents="none"
              className="stroke-brand-blue opacity-0 group-focus-visible:opacity-100"
            />

            <text
              x={box.x + 8}
              y={box.y + 22}
              className={cn(style.text, 'text-[16px] font-semibold')}
            >
              {room.room_number}
            </text>

            {/* Outline icon in a light disc, coloured through currentColor. */}
            <circle
              cx={box.x + box.width - 16}
              cy={box.y + 16}
              r={10}
              className="fill-surface"
              opacity={0.85}
            />
            <Icon
              x={box.x + box.width - 23}
              y={box.y + 9}
              width={14}
              height={14}
              strokeWidth={2.2}
              className={style.ink}
              aria-hidden="true"
            />

            <text x={box.x + 8} y={box.y + 38} className={cn(style.text, 'text-[9px] font-medium')}>
              {t(`combinedStatusShort.${style.labelKey}`)}
            </text>

            <text
              x={box.x + 8}
              y={bottom - (room.occupant_count || room.outstanding > 0 ? 22 : 9)}
              className="fill-ink text-[9.5px] font-medium"
            >
              {/* SVG text cannot ellipsis; trim so a long name cannot escape the card. */}
              {truncateVisible(room.tenant_name ?? t('room.noTenant'), 13)}
            </text>

            {room.occupant_count ? (
              <text x={box.x + 8} y={bottom - 8} className="fill-ink-muted text-[8.5px]">
                {t('room.occupantsValue', { count: room.occupant_count })}
              </text>
            ) : null}

            {room.outstanding > 0 ? (
              <text
                x={box.x + box.width - 8}
                y={bottom - 8}
                textAnchor="end"
                className="fill-brand-red-deep text-[9.5px] font-semibold tabular-nums"
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
