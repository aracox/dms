/**
 * The หอพัก / บ้านพัก split.
 *
 * The per-segment report views must partition the 24 real units exactly: every
 * number they produce has to add back up to the whole-property number the
 * dashboard shows above them. A split that quietly drops or double-counts a
 * unit is worse than no split at all, so each assertion here pins both the
 * segment figure and its sum.
 */

import { describe, expect, it } from 'vitest';

import { financeSummary, roomSummary, tenantSummary } from './aggregate';
import {
  SEED_TODAY,
  seedContracts,
  seedInvoices,
  seedPayments,
  seedRooms,
  withRoomType,
} from './fixtures';
import {
  PROPERTY_SEGMENTS,
  SEGMENT_VIEWS,
  bySegment,
  filterByView,
  filterRoomsByView,
  forView,
  parseSegmentView,
  partitionBySegment,
  propertySegment,
  viewSegments,
} from './segments';

describe('propertySegment', () => {
  it('treats only room_type house as บ้านพัก', () => {
    expect(propertySegment('house')).toBe('house');
    expect(propertySegment('standard')).toBe('dorm');
    expect(propertySegment('air_conditioned')).toBe('dorm');
    expect(propertySegment('studio')).toBe('dorm');
  });

  it('lists หอพัก before บ้านพัก', () => {
    expect([...PROPERTY_SEGMENTS]).toEqual(['dorm', 'house']);
  });
});

describe('partitionBySegment', () => {
  const rooms = partitionBySegment(seedRooms.filter((seedRoom) => !seedRoom.is_test));

  it('splits the 24 real units into 21 dorm rooms and 3 houses', () => {
    expect(rooms.dorm).toHaveLength(21);
    expect(rooms.house).toHaveLength(3);
    expect(rooms.dorm.length + rooms.house.length).toBe(24);
  });

  it('puts exactly H101-H103 in บ้านพัก', () => {
    expect(rooms.house.map((seedRoom) => seedRoom.room_number)).toEqual(['H101', 'H102', 'H103']);
  });
});

describe('bySegment', () => {
  it('fills in an empty row for a segment the view returned nothing for', () => {
    const indexed = bySegment([{ segment: 'dorm' as const, count: 7 }], () => ({ count: 0 }));

    expect(indexed.dorm.count).toBe(7);
    expect(indexed.house.count).toBe(0);
  });
});

describe('room reporting per segment', () => {
  const real = seedRooms.filter((seedRoom) => !seedRoom.is_test);
  const rooms = partitionBySegment(real);
  const dorm = roomSummary(rooms.dorm);
  const house = roomSummary(rooms.house);
  const combined = roomSummary(real);

  it('counts หอพัก: 21 rooms, 18 occupied, 2 vacant, 1 in maintenance', () => {
    expect(dorm.total_rooms).toBe(21);
    expect(dorm.occupied).toBe(18);
    expect(dorm.vacant).toBe(2);
    expect(dorm.reserved).toBe(0);
    expect(dorm.maintenance).toBe(1);
    expect(dorm.occupancy_rate).toBeCloseTo(85.71, 2);
  });

  it('counts บ้านพัก: 3 houses, 2 occupied, 1 reserved', () => {
    expect(house.total_rooms).toBe(3);
    expect(house.occupied).toBe(2);
    expect(house.vacant).toBe(0);
    expect(house.reserved).toBe(1);
    expect(house.maintenance).toBe(0);
    expect(house.occupancy_rate).toBeCloseTo(66.67, 2);
  });

  it('adds back up to the whole-property summary', () => {
    expect(dorm.total_rooms + house.total_rooms).toBe(combined.total_rooms);
    expect(dorm.occupied + house.occupied).toBe(combined.occupied);
    expect(dorm.vacant + house.vacant).toBe(combined.vacant);
    expect(dorm.reserved + house.reserved).toBe(combined.reserved);
    expect(dorm.maintenance + house.maintenance).toBe(combined.maintenance);
  });
});

describe('financial reporting per segment', () => {
  const contracts = partitionBySegment(withRoomType(seedContracts));
  const invoices = partitionBySegment(withRoomType(seedInvoices));
  const payments = partitionBySegment(withRoomType(seedPayments));

  const summaryFor = (segment: 'dorm' | 'house') =>
    financeSummary({
      contracts: contracts[segment],
      invoices: invoices[segment],
      payments: payments[segment],
      today: SEED_TODAY,
    });

  const dorm = summaryFor('dorm');
  const house = summaryFor('house');
  const combined = financeSummary({
    contracts: seedContracts,
    invoices: seedInvoices,
    payments: seedPayments,
    today: SEED_TODAY,
  });

  it('splits expected rent 18 : 2 active contracts', () => {
    expect(dorm.expected_rent).toBe(63_000);
    expect(house.expected_rent).toBe(7_000);
  });

  it('splits what was invoiced and collected this month', () => {
    expect(dorm.invoiced_total).toBe(77_940);
    expect(house.invoiced_total).toBe(8_660);
    expect(dorm.collected_this_month).toBe(77_940);
    expect(house.collected_this_month).toBe(2_220);
  });

  it('puts all of the unsettled money in บ้านพัก, where the seed leaves it', () => {
    expect(dorm.outstanding).toBe(0);
    expect(dorm.overdue).toBe(0);
    expect(house.outstanding).toBe(6_440);
    expect(house.overdue).toBe(6_440);
  });

  it('adds back up to the whole-property finance summary', () => {
    expect(dorm.expected_rent + house.expected_rent).toBe(combined.expected_rent);
    expect(dorm.invoiced_total + house.invoiced_total).toBe(combined.invoiced_total);
    expect(dorm.collected_this_month + house.collected_this_month).toBe(
      combined.collected_this_month,
    );
    expect(dorm.outstanding + house.outstanding).toBe(combined.outstanding);
    expect(dorm.overdue + house.overdue).toBe(combined.overdue);
  });

  it('never lets T01 into either segment', () => {
    // T01 is a standard room, so it would land in หอพัก if is_test leaked.
    expect(contracts.dorm.some((contract) => contract.is_test)).toBe(true);
    expect(dorm.expected_rent).not.toBe(66_500);
  });
});

describe('tenant reporting per segment', () => {
  const contracts = partitionBySegment(withRoomType(seedContracts));
  const dorm = tenantSummary(contracts.dorm);
  const house = tenantSummary(contracts.house);
  const combined = tenantSummary(seedContracts);

  it('counts 18 หอพัก tenants and 2 บ้านพัก tenants', () => {
    expect(dorm.registered_tenants).toBe(18);
    expect(house.registered_tenants).toBe(2);
  });

  it('counts 36 occupants in หอพัก and 5 in บ้านพัก', () => {
    expect(dorm.total_occupants).toBe(36);
    expect(house.total_occupants).toBe(5);
  });

  it('adds back up to the whole-property tenant summary', () => {
    expect(dorm.registered_tenants + house.registered_tenants).toBe(combined.registered_tenants);
    expect(dorm.total_occupants + house.total_occupants).toBe(combined.total_occupants);
  });
});

describe('parseSegmentView', () => {
  it('accepts the two segments and the combined view', () => {
    expect(parseSegmentView('all')).toBe('all');
    expect(parseSegmentView('dorm')).toBe('dorm');
    expect(parseSegmentView('house')).toBe('house');
  });

  it('falls back to the combined view when the parameter is absent or unknown', () => {
    expect(parseSegmentView(undefined)).toBe('all');
    expect(parseSegmentView('')).toBe('all');
    expect(parseSegmentView('DORM')).toBe('all');
    expect(parseSegmentView('apartments')).toBe('all');
  });

  it('takes the first value when the parameter is repeated', () => {
    expect(parseSegmentView(['house', 'dorm'])).toBe('house');
    expect(parseSegmentView([])).toBe('all');
    expect(parseSegmentView(['nonsense'])).toBe('all');
  });

  it('refuses an inherited property name, which `forView` would then index with', () => {
    // forView does perSegment[view], so the parser is what keeps a
    // hand-edited URL from reaching Object.prototype.
    expect(parseSegmentView('__proto__')).toBe('all');
    expect(parseSegmentView('constructor')).toBe('all');
    expect(parseSegmentView('toString')).toBe('all');
  });

  it('offers ทั้งหมด first, then the segments in display order', () => {
    expect([...SEGMENT_VIEWS]).toEqual(['all', 'dorm', 'house']);
  });
});

describe('forView', () => {
  const whole = { total_rooms: 24 };
  const perSegment = { dorm: { total_rooms: 21 }, house: { total_rooms: 3 } };

  it('reads the combined figures for ทั้งหมด', () => {
    expect(forView('all', whole, perSegment).total_rooms).toBe(24);
  });

  it('reads one segment own figures when filtered', () => {
    expect(forView('dorm', whole, perSegment).total_rooms).toBe(21);
    expect(forView('house', whole, perSegment).total_rooms).toBe(3);
  });
});

describe('filterByView', () => {
  const rows = [
    { id: 'a', property_segment: 'dorm' as const },
    { id: 'b', property_segment: 'house' as const },
    { id: 'c', property_segment: 'dorm' as const },
    // A common-area maintenance ticket: no room, so no segment.
    { id: 'd', property_segment: null },
  ];

  it('keeps every row on ทั้งหมด, including the segment-less one', () => {
    expect(filterByView('all', rows).map((row) => row.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps only the selected segment rows', () => {
    expect(filterByView('dorm', rows).map((row) => row.id)).toEqual(['a', 'c']);
    expect(filterByView('house', rows).map((row) => row.id)).toEqual(['b']);
  });

  it('hides a segment-less row rather than claiming it for either segment', () => {
    expect(filterByView('dorm', rows).some((row) => row.property_segment === null)).toBe(false);
    expect(filterByView('house', rows).some((row) => row.property_segment === null)).toBe(false);
  });

  it('does not mutate the rows it was given', () => {
    const original = [...rows];
    filterByView('dorm', rows);
    expect(rows).toEqual(original);
  });
});

describe('viewSegments', () => {
  it('draws both segments on ทั้งหมด and just the one when filtered', () => {
    expect([...viewSegments('all')]).toEqual(['dorm', 'house']);
    expect([...viewSegments('dorm')]).toEqual(['dorm']);
    expect([...viewSegments('house')]).toEqual(['house']);
  });
});

describe('filterRoomsByView', () => {
  // The rooms list reads v_room_board, which has room_type but no
  // property_segment -- the segment has to be derived, as it is in SQL.
  const real = seedRooms.filter((seedRoom) => !seedRoom.is_test);

  it('keeps all 24 real units on ทั้งหมด', () => {
    expect(filterRoomsByView('all', real)).toHaveLength(24);
  });

  it('narrows to the 21 dorm rooms', () => {
    const dorm = filterRoomsByView('dorm', real);
    expect(dorm).toHaveLength(21);
    expect(dorm.every((seedRoom) => seedRoom.room_type !== 'house')).toBe(true);
  });

  it('narrows to exactly H101-H103', () => {
    expect(filterRoomsByView('house', real).map((seedRoom) => seedRoom.room_number)).toEqual([
      'H101',
      'H102',
      'H103',
    ]);
  });

  it('partitions the units -- no unit lost, none counted twice', () => {
    const dorm = filterRoomsByView('dorm', real);
    const house = filterRoomsByView('house', real);
    expect(dorm.length + house.length).toBe(real.length);
    expect(new Set([...dorm, ...house]).size).toBe(real.length);
  });

  it('does not mutate the rows it was given', () => {
    const original = [...real];
    filterRoomsByView('house', real);
    expect(real).toEqual(original);
  });
});
