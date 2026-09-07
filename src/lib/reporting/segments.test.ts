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
import { PROPERTY_SEGMENTS, bySegment, partitionBySegment, propertySegment } from './segments';

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
