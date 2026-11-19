import { describe, expect, it } from 'vitest';

import { groupRoomStatus, type RoomStatusRow } from './room-status';

const room = (
  room_number: string,
  floor: number,
  property_segment: RoomStatusRow['property_segment'] = 'dorm',
): RoomStatusRow => ({
  room_id: `id-${room_number}`,
  room_number,
  floor,
  room_status: 'occupied',
  financial_status: 'paid',
  property_segment,
});

describe('groupRoomStatus', () => {
  it('orders dorm floors top-down with the houses last', () => {
    const groups = groupRoomStatus([
      room('101', 1),
      room('H101', 1, 'house'),
      room('301', 3),
      room('201', 2),
    ]);

    expect(groups.map((g) => (g.kind === 'floor' ? `floor-${g.floor}` : 'house'))).toEqual([
      'floor-3',
      'floor-2',
      'floor-1',
      'house',
    ]);
  });

  it('keeps houses out of floor 1 even though they share its floor number', () => {
    const groups = groupRoomStatus([room('101', 1), room('H101', 1, 'house')]);

    expect(groups[0]).toMatchObject({ kind: 'floor', floor: 1 });
    expect(groups[0]?.rooms.map((r) => r.room_number)).toEqual(['101']);
    expect(groups[1]?.rooms.map((r) => r.room_number)).toEqual(['H101']);
  });

  it('sorts rooms numerically within a row', () => {
    const [floor] = groupRoomStatus([room('110', 1), room('102', 1), room('101', 1)]);

    expect(floor?.rooms.map((r) => r.room_number)).toEqual(['101', '102', '110']);
  });

  it('drops empty groups, so a house-only view has a single row', () => {
    const groups = groupRoomStatus([room('H102', 1, 'house'), room('H101', 1, 'house')]);

    expect(groups).toEqual([
      { kind: 'house', rooms: [room('H101', 1, 'house'), room('H102', 1, 'house')] },
    ]);
  });
});
