'use client';

import { Building2, Map as MapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RoomQuickView } from '@/components/room/RoomQuickView';
import { STATUS_ICONS } from '@/components/status/RoomStatusBadge';
import {
  LEGEND_ORDER,
  STATUS_STYLES,
  toDisplayStatus,
  type RoomDisplayStatus,
} from '@/components/status/status-styles';
import { Drawer } from '@/components/ui/Drawer';
import { FLOOR_LAYOUTS, type FloorNumber } from '@/config/floor-layout';
import type { Locale } from '@/i18n/routing';
import { propertySegment, type SegmentView } from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import type { RoomBoardRow } from '@/types/database';

import { BuildingSvg } from './BuildingSvg';
import { FloorPlanSvg } from './FloorPlanSvg';

type ViewMode = 'plan' | 'building';

/**
 * The interactive floor plan.
 *
 * All 24 rooms arrive from the server in one payload, so switching floors and
 * opening a room are instant and need no further requests.
 */
export function FloorPlanView({
  rooms,
  view,
  locale,
  initialFloor = 1,
}: {
  rooms: RoomBoardRow[];
  view: SegmentView;
  locale: Locale;
  initialFloor?: FloorNumber;
}) {
  const t = useTranslations();
  const [floor, setFloor] = useState<FloorNumber>(initialFloor);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('plan');

  const roomsByNumber = useMemo(
    () => new Map(rooms.map((room) => [room.room_number, room])),
    [rooms],
  );

  /**
   * Room numbers the segment filter excludes. They stay on the plan -- a
   * building does not lose rooms because you filtered -- but are dimmed and
   * non-interactive.
   */
  const dimmed = useMemo(
    () =>
      view === 'all'
        ? new Set<string>()
        : new Set(
            rooms
              .filter((room) => propertySegment(room.room_type) !== view)
              .map((room) => room.room_number),
          ),
    [rooms, view],
  );

  /**
   * Floors holding at least one unit of the selected segment. บ้านพัก leaves
   * only floor 1, since H101-H103 are the whole segment and they all sit there.
   */
  const floorsWithUnits = useMemo(
    () =>
      FLOOR_LAYOUTS.filter((candidate) =>
        candidate.rooms.some(
          (roomLayout) =>
            roomsByNumber.has(roomLayout.roomNumber) && !dimmed.has(roomLayout.roomNumber),
        ),
      ).map((candidate) => candidate.floor as FloorNumber),
    [roomsByNumber, dimmed],
  );

  // Switching segment is a navigation, not a remount, so the floor picked
  // before the change survives it -- and may now hold nothing. Fall back to a
  // floor that does, keeping `floor` itself untouched so returning to ทั้งหมด
  // returns to where you were.
  const activeFloor = floorsWithUnits.includes(floor) ? floor : (floorsWithUnits[0] ?? floor);
  const layout = FLOOR_LAYOUTS.find((candidate) => candidate.floor === activeFloor);

  // A room opened before the filter changed can survive it too. Drop the
  // selection when the filter no longer includes it.
  const selectedRoom =
    selectedRoomNumber && !dimmed.has(selectedRoomNumber)
      ? roomsByNumber.get(selectedRoomNumber)
      : undefined;

  /** Occupied / total per segment for one floor, counting only units the filter shows. */
  const occupancyOf = (floorLayout: (typeof FLOOR_LAYOUTS)[number]) => {
    const counts = { dorm: { occupied: 0, total: 0 }, house: { occupied: 0, total: 0 } };
    for (const roomLayout of floorLayout.rooms) {
      const room = roomsByNumber.get(roomLayout.roomNumber);
      if (!room || dimmed.has(room.room_number)) continue;
      const bucket = counts[propertySegment(room.room_type)];
      bucket.total += 1;
      if (room.room_status === 'occupied') bucket.occupied += 1;
    }
    return counts;
  };

  /**
   * How many units are in each status, worst first -- on this floor, or across
   * the whole building in the building view. Doubles as the legend: only
   * statuses actually shown are listed.
   */
  const statusCounts = new Map<RoomDisplayStatus, number>();
  const countedRooms =
    mode === 'building'
      ? FLOOR_LAYOUTS.flatMap((candidate) => candidate.rooms)
      : (layout?.rooms ?? []);
  for (const roomLayout of countedRooms) {
    const room = roomsByNumber.get(roomLayout.roomNumber);
    if (!room || dimmed.has(room.room_number)) continue;
    const status = toDisplayStatus(
      room.room_status,
      room.financial_status,
      Boolean(room.notice_given_at),
    );
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const floorUnits = layout?.rooms.length ?? 0;
  const shownUnits = layout
    ? layout.rooms.filter((roomLayout) => !dimmed.has(roomLayout.roomNumber)).length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label={t('floorPlan.viewMode')}
            className="bg-surface-sunken flex gap-0.5 rounded-lg p-0.5"
          >
            {(
              [
                ['plan', MapIcon, t('floorPlan.viewPlan')],
                ['building', Building2, t('floorPlan.viewBuilding')],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'text-caption flex h-11 items-center gap-1.5 rounded-md px-3 font-medium transition-colors',
                  mode === value
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {mode === 'plan' ? (
            <div role="tablist" aria-label={t('floorPlan.title')} className="flex flex-wrap gap-2">
              {FLOOR_LAYOUTS.map((candidate) => {
                const isActive = candidate.floor === activeFloor;
                // Nothing of the selected segment on this floor, so there is nothing
                // to switch to. Disabled rather than hidden: the building still has
                // three floors, and the tabs should not move under you.
                const isEmpty = !floorsWithUnits.includes(candidate.floor as FloorNumber);
                const { dorm, house } = occupancyOf(candidate);
                const summary = [
                  dorm.total > 0 && t('floorPlan.occupiedOf', dorm),
                  house.total > 0 && t('floorPlan.housesOf', house),
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <button
                    key={candidate.floor}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    disabled={isEmpty}
                    title={isEmpty ? t('floorPlan.noUnitsOnFloor') : undefined}
                    onClick={() => setFloor(candidate.floor as FloorNumber)}
                    className={cn(
                      'flex min-h-12 flex-col items-start justify-center rounded-lg border px-4 py-1.5 text-left transition-colors',
                      'disabled:cursor-not-allowed disabled:opacity-35',
                      isActive
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'bg-surface border-border text-ink enabled:hover:bg-surface-sunken',
                    )}
                  >
                    <span className="font-display text-body-sm font-semibold">
                      {t('floorPlan.floor', { floor: candidate.floor })}
                    </span>
                    {summary ? (
                      <span
                        className={cn(
                          'text-[11px]',
                          isActive ? 'text-white/80' : 'text-ink-subtle',
                        )}
                      >
                        {summary}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <ul aria-label={t('floorPlan.legend')} className="flex flex-wrap gap-1.5">
          {LEGEND_ORDER.filter((status) => statusCounts.has(status)).map((status) => {
            const style = STATUS_STYLES[status];
            const Icon = STATUS_ICONS[style.icon];
            return (
              <li
                key={status}
                className={cn(
                  'text-caption flex h-7 items-center gap-1.5 rounded-full border px-2.5',
                  style.badge,
                )}
              >
                <Icon size={12} aria-hidden="true" />
                {t(`combinedStatusShort.${style.labelKey}`)}
                <span className="font-semibold tabular-nums">{statusCounts.get(status)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="bg-surface border-border flex min-h-0 flex-1 flex-col rounded-xl border p-4 shadow-md">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {mode === 'building' ? (
            <BuildingSvg
              roomsByNumber={roomsByNumber}
              dimmed={dimmed}
              selectedRoomNumber={selectedRoomNumber}
              onSelectRoom={setSelectedRoomNumber}
              locale={locale}
            />
          ) : layout ? (
            <FloorPlanSvg
              layout={layout}
              roomsByNumber={roomsByNumber}
              dimmed={dimmed}
              selectedRoomNumber={selectedRoomNumber}
              onSelectRoom={setSelectedRoomNumber}
              locale={locale}
            />
          ) : (
            <p className="text-ink-subtle text-body-sm py-12 text-center">
              {t('floorPlan.noRooms')}
            </p>
          )}
        </div>
        {/* Says what the dimming means, and makes the count legible to a
            screen reader, which the faded units are hidden from. */}
        {view === 'all' || mode === 'building' ? null : (
          <p className="text-ink-muted text-caption mt-3 text-center" aria-live="polite">
            {t('floorPlan.segmentShown', {
              segment: t(`segment.${view}`),
              shown: shownUnits,
              total: floorUnits,
            })}
          </p>
        )}
      </div>

      <Drawer
        open={Boolean(selectedRoom)}
        onClose={() => setSelectedRoomNumber(null)}
        closeLabel={t('common.close')}
        title={selectedRoom ? t('room.title', { roomNumber: selectedRoom.room_number }) : ''}
        subtitle={
          selectedRoom
            ? `${t('floorPlan.floor', { floor: selectedRoom.floor })} · ${t(`roomType.${selectedRoom.room_type}`)}`
            : undefined
        }
      >
        {selectedRoom ? <RoomQuickView room={selectedRoom} locale={locale} /> : null}
      </Drawer>
    </div>
  );
}
