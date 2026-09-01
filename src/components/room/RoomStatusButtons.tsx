'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { updateRoomStatusAction, type UpdateRoomStatusState } from '@/lib/rooms/actions';
import type { RoomStatus } from '@/types/database';

const INITIAL_STATE: UpdateRoomStatusState = { error: null };

function StatusButton({
  roomId,
  status,
  label,
}: {
  roomId: string;
  status: RoomStatus;
  label: string;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updateRoomStatusAction, INITIAL_STATE);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="status" value={status} />
        <button
          type="submit"
          disabled={isPending}
          className="border-border text-ink hover:bg-surface-sunken rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          {isPending ? t('common.loading') : label}
        </button>
      </form>
      {state.error ? <p className="text-brand-red-deep mt-1 text-xs">{t(state.error)}</p> : null}
    </div>
  );
}

/** Buttons to move a vacant/reserved/under-maintenance room between those three states. */
export function RoomStatusButtons({
  roomId,
  status,
}: {
  roomId: string;
  status: 'vacant' | 'reserved' | 'maintenance';
}) {
  const t = useTranslations();

  if (status === 'vacant') {
    return (
      <div className="flex items-center gap-2">
        <StatusButton roomId={roomId} status="reserved" label={t('room.markReserved')} />
        <StatusButton roomId={roomId} status="maintenance" label={t('room.markMaintenance')} />
      </div>
    );
  }

  if (status === 'reserved') {
    return <StatusButton roomId={roomId} status="vacant" label={t('room.cancelReservation')} />;
  }

  return <StatusButton roomId={roomId} status="vacant" label={t('room.finishMaintenance')} />;
}
