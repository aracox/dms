import { describe, expect, it } from 'vitest';

import type { MeterUsageRow } from '@/types/database';

import {
  compareMeterRoomProgress,
  groupMeterReadingsByRoom,
  isMeterRoomForMonth,
  meterRoomIsComplete,
} from './room-progress';

function reading(roomId: string, meterType: 'electricity' | 'water'): MeterUsageRow {
  return {
    billing_month: '2026-09-01',
    meter_type: meterType,
    room_id: roomId,
    room_number: roomId,
    floor: 1,
    previous_reading: 100,
    current_reading: 110,
    usage: 10,
    rate: 7,
    amount: 70,
  };
}

describe('meter room progress', () => {
  it('groups both meter types and marks only complete rooms as complete', () => {
    const grouped = groupMeterReadingsByRoom([
      reading('101', 'electricity'),
      reading('101', 'water'),
      reading('102', 'electricity'),
    ]);

    expect(meterRoomIsComplete(grouped.get('101'))).toBe(true);
    expect(meterRoomIsComplete(grouped.get('102'))).toBe(false);
    expect(meterRoomIsComplete(grouped.get('103'))).toBe(false);
  });

  it('shows incomplete rooms first, then orders by room number', () => {
    const rooms = [
      { room_number: '202', complete: true },
      { room_number: '103', complete: false },
      { room_number: '101', complete: false },
    ];

    expect(rooms.sort(compareMeterRoomProgress).map((room) => room.room_number)).toEqual([
      '101',
      '103',
      '202',
    ]);
  });

  it('lists a month for rooms with readings and contracts that had started by then', () => {
    const readings = groupMeterReadingsByRoom([reading('101', 'electricity')]).get('101');
    const active = (start: string) => ({ contract_status: 'active' as const, start_date: start });
    const ended = { contract_status: 'terminated' as const, start_date: '2025-01-15' };

    // A moved-out room still shows in a month it has a reading for.
    expect(isMeterRoomForMonth(ended, readings, '2026-09-01')).toBe(true);
    expect(isMeterRoomForMonth(ended, undefined, '2026-09-01')).toBe(false);
    // An active room is owed readings from its move-in month on, not before.
    expect(isMeterRoomForMonth(active('2026-09-20'), undefined, '2026-09-01')).toBe(true);
    expect(isMeterRoomForMonth(active('2026-10-03'), undefined, '2026-09-01')).toBe(false);
  });
});
