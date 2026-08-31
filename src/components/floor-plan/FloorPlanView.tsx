'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RoomQuickView } from '@/components/room/RoomQuickView';
import { Drawer } from '@/components/ui/Drawer';
import { FLOOR_LAYOUTS, type FloorNumber } from '@/config/floor-layout';
import type { Locale } from '@/i18n/routing';
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
  locale,
  initialFloor = 1,
}: {
  rooms: RoomBoardRow[];
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

  const layout = FLOOR_LAYOUTS.find((candidate) => candidate.floor === floor);
  const selectedRoom = selectedRoomNumber ? roomsByNumber.get(selectedRoomNumber) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div role="tablist" aria-label={t('floorPlan.title')} className="flex shrink-0 gap-1">
        {FLOOR_LAYOUTS.map((candidate) => {
          const isActive = candidate.floor === floor;

          return (
            <button
              key={candidate.floor}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFloor(candidate.floor as FloorNumber)}
              className={cn(
                'rounded-md border px-4 py-2 text-sm font-medium',
                isActive
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-border bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {t('floorPlan.floor', { floor: candidate.floor })}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="bg-surface flex min-h-0 items-center justify-center rounded-lg p-3">
          {layout ? (
            <FloorPlanSvg
              layout={layout}
              roomsByNumber={roomsByNumber}
              selectedRoomNumber={selectedRoomNumber}
              onSelectRoom={setSelectedRoomNumber}
              locale={locale}
            />
          ) : (
            <p className="text-ink-subtle py-12 text-center text-sm">{t('floorPlan.noRooms')}</p>
          )}
        </div>

        <aside className="bg-surface min-h-0 overflow-y-auto rounded-lg p-3">
          <StatusLegend />
          <p className="text-ink-subtle mt-4 pt-3 text-xs">{t('floorPlan.subtitle')}</p>
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
