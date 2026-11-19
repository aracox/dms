'use client';

import { useTranslations } from 'next-intl';

import { STATUS_ICONS } from '@/components/status/RoomStatusBadge';
import { STATUS_STYLES, toDisplayStatus } from '@/components/status/status-styles';
import { FLOOR_LAYOUTS } from '@/config/floor-layout';
import type { Locale } from '@/i18n/routing';
import { propertySegment } from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import type { RoomBoardRow } from '@/types/database';

import { BUILDING, buildingGeometry, type Box } from './building-geometry';
import { roomControlProps, useRoomLabel } from './room-control';

const { depthX: DX, depthY: DY, floorHeight: FH } = BUILDING;

/** A point `t` of the way back along the building's depth from (x, y). */
const back = (x: number, y: number, t = 1) => `${x + DX * t},${y + DY * t}`;

/**
 * The whole building at once, in 2.5D, after the owner's watercolour sketch:
 * cream walls under a timber roof, brick lattice at both ends, open corridors
 * with railings on the upper floors, and an arched stair tower past the last
 * room. Each room is a door on the facade in its status colour, clickable like
 * the floor plan. The facade faces the viewer flat-on so Thai labels stay
 * upright; the end wall and roof give the depth.
 */
export function BuildingSvg({
  roomsByNumber,
  dimmed,
  selectedRoomNumber,
  onSelectRoom,
  locale,
}: {
  roomsByNumber: Map<string, RoomBoardRow>;
  dimmed: Set<string>;
  selectedRoomNumber: string | null;
  onSelectRoom: (roomNumber: string) => void;
  locale: Locale;
}) {
  const t = useTranslations();
  const roomLabel = useRoomLabel(locale);

  const isHouse = (roomNumber: string) => {
    const room = roomsByNumber.get(roomNumber);
    return room ? propertySegment(room.room_type) === 'house' : false;
  };
  const g = buildingGeometry(FLOOR_LAYOUTS, isHouse);
  const roofY = g.top - 4;
  const left = g.x0 - BUILDING.roofOverhang;
  const right = g.right + BUILDING.roofOverhang;

  /** Status panel, number, icon and short status for one unit. */
  const renderUnit = (roomNumber: string, box: Box, kind: 'room' | 'house') => {
    const room = roomsByNumber.get(roomNumber);
    if (!room) return null;

    const status = toDisplayStatus(
      room.room_status,
      room.financial_status,
      Boolean(room.notice_given_at),
    );
    const style = STATUS_STYLES[status];
    const Icon = STATUS_ICONS[style.icon];
    const isSelected = selectedRoomNumber === roomNumber;
    const isDimmed = dimmed.has(roomNumber);
    // Rooms stop short of the floor slab above; houses fill their body.
    const panel =
      kind === 'room'
        ? { x: box.x + 3, y: box.y + 9, width: box.width - 6, height: box.height - 9 }
        : { x: box.x, y: box.y, width: box.width, height: box.height };

    return (
      <g
        key={roomNumber}
        {...roomControlProps({
          label: roomLabel(room, t(`combinedStatus.${style.labelKey}`)),
          selected: isSelected,
          dimmed: isDimmed,
          onSelect: () => onSelectRoom(roomNumber),
        })}
        className={cn(
          'group transition-opacity',
          isDimmed ? 'pointer-events-none opacity-20' : 'cursor-pointer',
        )}
      >
        <rect
          {...panel}
          rx={kind === 'room' ? 4 : 2}
          className={cn(
            style.fill,
            style.stroke,
            'transition-[stroke-width,filter]',
            isSelected ? 'drop-shadow-lg' : !isDimmed && 'group-hover:drop-shadow-md',
            !isDimmed && !isSelected && 'group-hover:[stroke-width:2.5]',
          )}
          strokeWidth={isSelected ? 3.5 : 1.2}
          strokeDasharray={status === 'vacant' ? '5 3' : undefined}
        />
        {style.hatched ? (
          <rect {...panel} fill="url(#hatch-maintenance)" opacity="0.25" pointerEvents="none" />
        ) : null}
        {/* Keyboard focus ring, inset so it hugs the panel. */}
        <rect
          x={panel.x + 3}
          y={panel.y + 3}
          width={panel.width - 6}
          height={panel.height - 6}
          rx={2}
          fill="none"
          strokeWidth="2"
          pointerEvents="none"
          className="stroke-brand-blue opacity-0 group-focus-visible:opacity-100"
        />

        {/* Door and window, tinted in the status ink. */}
        <rect
          x={panel.x + panel.width - 24}
          y={panel.y + 34}
          width={15}
          height={panel.height - 34}
          rx={1.5}
          className={style.text}
          opacity={0.2}
          pointerEvents="none"
        />
        <rect
          x={panel.x + 7}
          y={panel.y + 40}
          width={28}
          height={16}
          rx={1.5}
          className="fill-surface stroke-border-strong"
          strokeWidth={1}
          opacity={0.85}
          pointerEvents="none"
        />

        <text
          x={panel.x + 7}
          y={panel.y + 16}
          className={cn(style.text, 'text-[13px] font-semibold')}
        >
          {roomNumber}
        </text>
        <circle
          cx={panel.x + panel.width - 13}
          cy={panel.y + 12}
          r={8.5}
          className="fill-surface"
          opacity={0.85}
        />
        <Icon
          x={panel.x + panel.width - 19}
          y={panel.y + 6}
          width={12}
          height={12}
          strokeWidth={2.2}
          className={style.ink}
          aria-hidden="true"
        />
        <text
          x={panel.x + 7}
          y={panel.y + 29}
          className={cn(style.text, 'text-[8.5px] font-medium')}
        >
          {t(`combinedStatusShort.${style.labelKey}`)}
        </text>
      </g>
    );
  };

  const housesLeft = g.houses[0]?.x;
  const housesDimmed = g.houses.every((house) => dimmed.has(house.roomNumber));

  return (
    <svg
      viewBox={g.viewBox}
      role="group"
      aria-label={t('floorPlan.viewBuilding')}
      className="mx-auto block h-full max-h-full w-full select-none"
    >
      <defs>
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
        {/* Brick breeze-block screen. */}
        <pattern id="lattice" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" className="fill-brand-brown/75" />
          <rect x="1.5" y="1.5" width="5" height="5" className="fill-surface-sunken" />
        </pattern>
      </defs>

      {/* Ground and the building's shadow on it. */}
      <rect
        x={g.x0 + DX - 30}
        y={-2}
        width={(housesLeft ? g.houses.at(-1)!.x + BUILDING.house.width : g.right) - g.x0 - DX + 50}
        height={16}
        rx={8}
        className="fill-brand-green-soft"
      />
      <polygon
        points={`${g.x0},0 ${g.right},0 ${g.right + DX},${DY / 3} ${g.x0 + DX},${DY / 3}`}
        className="fill-ink/5"
      />

      {/* A tree past the last house, as in the sketch. */}
      <Tree
        x={(housesLeft !== undefined ? g.houses.at(-1)!.x + BUILDING.house.width : g.right) + 32}
        scale={1.15}
      />

      {/* End wall, receding up and to the left, with one window per floor. */}
      <polygon
        points={`${g.x0},${g.top} ${g.x0},0 ${back(g.x0, 0)} ${back(g.x0, g.top)}`}
        className="fill-surface-sunken stroke-border-strong"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {g.floors.map((band) => (
        <polygon
          key={`side-${band.floor}`}
          points={[
            back(g.x0, band.top + 30, 0.36),
            back(g.x0, band.top + 30, 0.64),
            back(g.x0, band.top + 58, 0.64),
            back(g.x0, band.top + 58, 0.36),
          ].join(' ')}
          className="fill-surface stroke-border-strong"
          strokeWidth={1}
        />
      ))}

      {/* Facade wall, lattice screens, and the slab between floors. */}
      <rect
        x={g.x0}
        y={g.top}
        width={g.right - g.x0}
        height={-g.top}
        className="fill-surface stroke-border-strong"
        strokeWidth={1.2}
      />
      <rect x={g.x0} y={g.top} width={BUILDING.lattice} height={-g.top} fill="url(#lattice)" />
      {g.stairs ? (
        <rect
          x={g.stairs.x + g.stairs.width}
          y={g.top}
          width={BUILDING.lattice}
          height={-g.top}
          fill="url(#lattice)"
        />
      ) : null}
      {g.floors.slice(1).map((band) => (
        <rect
          key={`slab-${band.floor}`}
          x={g.x0}
          y={band.bottom - 3}
          width={g.right - g.x0}
          height={6}
          className="fill-surface-sunken stroke-border-strong"
          strokeWidth={0.8}
        />
      ))}

      {/* Stair tower: an arched opening per floor with a flight inside. */}
      {g.stairs
        ? g.floors.map((band) => {
            const x = g.stairs!.x + 12;
            const w = g.stairs!.width - 24;
            const r = w / 2;
            const yTop = band.top + 14;
            const yBottom = band.bottom - 4;
            return (
              <g key={`stair-${band.floor}`} aria-hidden="true">
                <path
                  d={`M${x} ${yBottom} V${yTop + r} A${r} ${r} 0 0 1 ${x + w} ${yTop + r} V${yBottom} Z`}
                  className="fill-surface-sunken stroke-border-strong"
                  strokeWidth={1}
                />
                <line
                  x1={x + 6}
                  y1={yBottom - 4}
                  x2={x + w - 6}
                  y2={yTop + r}
                  className="stroke-border-strong"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                />
              </g>
            );
          })
        : null}

      {g.rooms.map((room) => renderUnit(room.roomNumber, room, 'room'))}

      {/* Corridor railings on the upper floors, drawn over the room fronts. */}
      {g.floors.slice(1).map((band) => {
        const railTop = band.bottom - 24;
        const posts = [];
        for (let x = g.roomsLeft + 4; x < g.roomsRight; x += 5) posts.push(x);
        return (
          <g key={`rail-${band.floor}`} pointerEvents="none" aria-hidden="true">
            <line
              x1={g.roomsLeft}
              y1={railTop}
              x2={g.roomsRight}
              y2={railTop}
              className="stroke-ink/60"
              strokeWidth={1.6}
            />
            {posts.map((x) => (
              <line
                key={x}
                x1={x}
                y1={railTop}
                x2={x}
                y2={band.bottom - 3}
                className="stroke-ink/30"
                strokeWidth={0.8}
              />
            ))}
          </g>
        );
      })}

      {/* Planting along the ground floor. */}
      <g pointerEvents="none" aria-hidden="true">
        {Array.from(
          { length: Math.floor((g.roomsRight - g.roomsLeft) / 20) },
          (_, i) => g.roomsLeft + 10 + i * 20,
        ).map((x) => (
          <ellipse key={x} cx={x} cy={-1} rx={11} ry={5} className="fill-brand-green/30" />
        ))}
      </g>

      {/* Timber roof: the top face back along the depth, then the fascia. */}
      <polygon
        points={`${left},${roofY} ${right},${roofY} ${back(right, roofY)} ${back(left, roofY)}`}
        className="fill-brand-brown-soft stroke-border-strong"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect
        x={left}
        y={roofY}
        width={right - left}
        height={BUILDING.fascia}
        className="fill-brand-brown/60"
      />

      {/* Floor labels, left of the end wall. */}
      {g.floors.map((band) => (
        <text
          key={`label-${band.floor}`}
          x={g.x0 + DX - 8}
          y={band.top + FH / 2 + DY / 2 + 4}
          textAnchor="end"
          className="fill-ink-muted text-[11px] font-medium"
        >
          {t('floorPlan.floor', { floor: band.floor })}
        </text>
      ))}

      {/* Houses: cottages in a row beside the building. */}
      {housesLeft !== undefined ? (
        <text
          x={housesLeft}
          y={-BUILDING.house.bodyHeight - BUILDING.house.roofHeight - 10}
          className={cn('fill-ink-muted text-[11px] font-semibold', housesDimmed && 'opacity-20')}
        >
          {t('segment.house')}
        </text>
      ) : null}
      {g.houses.map((house) => (
        <g key={house.roomNumber}>
          <polygon
            points={`${house.x - 6},${house.y} ${house.x + house.width / 2},${house.y - BUILDING.house.roofHeight} ${house.x + house.width + 6},${house.y}`}
            className={cn(
              'fill-brand-brown/60 stroke-brand-brown-deep/40 transition-opacity',
              dimmed.has(house.roomNumber) && 'opacity-20',
            )}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {renderUnit(house.roomNumber, house, 'house')}
        </g>
      ))}
    </svg>
  );
}

/** A soft watercolour-ish tree: a trunk under overlapping canopy discs. */
function Tree({ x, scale }: { x: number; scale: number }) {
  const s = scale;
  return (
    <g pointerEvents="none" aria-hidden="true">
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={-70 * s}
        className="stroke-brand-brown/50"
        strokeWidth={3 * s}
      />
      <circle cx={x - 12 * s} cy={-78 * s} r={20 * s} className="fill-brand-teal/35" />
      <circle cx={x + 10 * s} cy={-86 * s} r={22 * s} className="fill-brand-green/25" />
      <circle cx={x} cy={-102 * s} r={18 * s} className="fill-brand-teal/30" />
    </g>
  );
}
