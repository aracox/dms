import { describe, expect, it } from 'vitest';

import { compareBillingRooms } from './room-priority';

describe('compareBillingRooms', () => {
  it('shows urgent billing work first and paid rooms last', () => {
    const rooms = [
      { room_number: '202', financial_status: 'paid' as const },
      { room_number: '103', financial_status: 'payment_due' as const },
      { room_number: '102', financial_status: 'none' as const },
      { room_number: '201', financial_status: 'overdue' as const },
      { room_number: '101', financial_status: 'overdue' as const },
    ];

    expect(rooms.sort(compareBillingRooms).map((room) => room.room_number)).toEqual([
      '101',
      '201',
      '103',
      '102',
      '202',
    ]);
  });
});
