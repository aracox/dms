'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RoomQuickView } from '@/components/room/RoomQuickView';
import { Drawer } from '@/components/ui/Drawer';
import { FLOOR_LAYOUTS, type FloorNumber } from '@/config/floor-layout';
import type { Locale } from '@/i18n/routing';
import { propertySegment, type SegmentView } from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import type { RoomBoardRow } from '@/types/database';

import { FloorPlanSvg } from './FloorPlanSvg';
import { StatusLegend } from './StatusLegend';

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

  const floorUnits = layout?.rooms.length ?? 0;
  const shownUnits = layout
    ? layout.rooms.filter((roomLayout) => !dimmed.has(roomLayout.roomNumber)).length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div role="tablist" aria-label={t('floorPlan.title')} className="flex shrink-0 gap-1">
        {FLOOR_LAYOUTS.map((candidate) => {
          const isActive = candidate.floor === activeFloor;
          // Nothing of the selected segment on this floor, so there is nothing
          // to switch to. Disabled rather than hidden: the building still has
          // three floors, and the tabs should not move under you.
          const isEmpty = !floorsWithUnits.includes(candidate.floor as FloorNumber);

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
                'rounded-md border px-4 py-2 text-sm font-medium',
                'disabled:cursor-not-allowed disabled:opacity-35',
                isActive
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-border bg-surface text-ink-muted enabled:hover:text-ink',
              )}
            >
              {t('floorPlan.floor', { floor: candidate.floor })}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="glass border-border flex min-h-0 items-center justify-center rounded-xl border p-3 shadow-sm">
          {layout ? (
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

        <aside className="glass border-border min-h-0 overflow-y-auto rounded-xl border p-3 shadow-sm">
          <StatusLegend />
          {/* Says what the dimming means, and makes the count legible to a
              screen reader, which the faded units are hidden from. */}
          {view === 'all' ? null : (
            <p className="text-ink-muted text-caption mt-4 pt-3" aria-live="polite">
              {t('floorPlan.segmentShown', {
                segment: t(`segment.${view}`),
                shown: shownUnits,
                total: floorUnits,
              })}
            </p>
          )}
          <p className="text-ink-subtle text-caption mt-4 pt-3">{t('floorPlan.subtitle')}</p>
        </aside>
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
