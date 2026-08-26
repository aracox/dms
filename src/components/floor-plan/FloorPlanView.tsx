'use client';

import { Info } from 'lucide-react';
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
 * All 21 rooms arrive from the server in one payload, so switching floors and
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
  const anyProvisional = FLOOR_LAYOUTS.some((candidate) => candidate.provisional);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t('floorPlan.title')} className="flex gap-1">
        {FLOOR_LAYOUTS.map((candidate) => {
          const isActive = candidate.floor === floor;
          const roomCount = candidate.rooms.length;

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
              <span
                className={cn('ml-1.5 text-xs', isActive ? 'text-white/80' : 'text-ink-subtle')}
              >
                {roomCount}
              </span>
            </button>
          );
        })}
      </div>

      {anyProvisional ? (
        <div className="border-brand-yellow bg-brand-yellow-soft text-brand-yellow-deep flex gap-2 rounded-md border px-3 py-2 text-xs">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">{t('floorPlan.provisional')}</strong>{' '}
            {t('floorPlan.provisionalDetail')}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="border-border bg-surface rounded-lg border p-3">
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

        <aside className="border-border bg-surface rounded-lg border p-3">
          <StatusLegend />
          <p className="border-border text-ink-subtle mt-4 border-t pt-3 text-xs">
            {t('floorPlan.subtitle')}
          </p>
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
