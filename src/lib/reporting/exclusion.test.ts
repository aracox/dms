/**
 * THE regression test for the project's most important invariant:
 *
 *   T01 data must never affect production reporting totals.
 *
 * Three layers of defence are checked here:
 *
 *   1. Arithmetic  -- the aggregations exclude test rows, and would produce
 *                     visibly different numbers if they did not.
 *   2. Architecture -- every query in reporting/queries.ts targets a report_*
 *                     view, and those views hard-filter is_test = false in SQL.
 *   3. Schema      -- the migration pins test rooms to floor 0 and forces child
 *                     rows to inherit is_test from their room.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { excludeTest, financeSummary, roomSummary, tenantSummary } from './aggregate';
import {
  SEED_MONTHLY_RENT,
  SEED_MONTHS,
  SEED_START_MONTH,
  SEED_TODAY,
  seedContracts,
  seedInvoices,
  seedPayments,
  seedRooms,
} from './fixtures';

const readRepoFile = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the seed fixture actually contains test data', () => {
  // Without this, every assertion below would pass trivially.
  it('includes exactly one test room and 24 real rooms', () => {
    expect(seedRooms.filter((room) => room.is_test)).toHaveLength(1);
    expect(seedRooms.filter((room) => !room.is_test)).toHaveLength(24);
    expect(seedRooms).toHaveLength(25);
  });

  it('gives the test room a contract, an invoice and a payment', () => {
    expect(seedContracts.some((c) => c.is_test)).toBe(true);
    expect(seedInvoices.some((i) => i.is_test)).toBe(true);
    expect(seedPayments.some((p) => p.is_test)).toBe(true);
  });
});

describe('room reporting excludes T01', () => {
  const summary = roomSummary(seedRooms);

  it('counts 24 rooms, not 25', () => {
    expect(summary.total_rooms).toBe(24);
  });

  it('reports occupancy over the real rooms only', () => {
    expect(summary.occupied).toBe(20);
    expect(summary.vacant).toBe(2);
    expect(summary.reserved).toBe(1);
    expect(summary.maintenance).toBe(1);
    expect(summary.occupied + summary.vacant + summary.reserved + summary.maintenance).toBe(24);
  });

  it('computes the occupancy rate from 24', () => {
    // 20 / 24 = 83.3%. T01 never contributes to either side.
    expect(summary.occupancy_rate).toBeCloseTo(83.33, 2);
  });

  it('would report different numbers if T01 leaked in', () => {
    const leaked = roomSummary(seedRooms.map((room) => ({ ...room, is_test: false })));
    expect(leaked.total_rooms).toBe(25);
    expect(leaked.occupied).toBe(21);
    expect(leaked.total_rooms).not.toBe(summary.total_rooms);
  });
});

describe('financial reporting excludes T01', () => {
  const finance = financeSummary({
    contracts: seedContracts,
    invoices: seedInvoices,
    payments: seedPayments,
    today: SEED_TODAY,
  });

  it('excludes the T01 rent from expected revenue', () => {
    expect(finance.expected_rent).toBe(70_000);
  });

  it('excludes the T01 invoice from the invoiced total', () => {
    expect(finance.invoiced_total).toBe(86_600);
  });

  it('excludes the T01 payment from collected revenue', () => {
    expect(finance.collected_this_month).toBe(80_160);
  });

  it('excludes T01 from outstanding and overdue', () => {
    expect(finance.outstanding).toBe(6_440);
    expect(finance.overdue).toBe(6_440);
  });

  it('would report different numbers if T01 leaked in', () => {
    const leaked = financeSummary({
      contracts: seedContracts.map((c) => ({ ...c, is_test: false })),
      invoices: seedInvoices.map((i) => ({ ...i, is_test: false })),
      payments: seedPayments.map((p) => ({ ...p, is_test: false })),
      today: SEED_TODAY,
    });

    expect(leaked.expected_rent).toBe(73_500);
    expect(leaked.invoiced_total).toBe(91_260);
    expect(leaked.collected_this_month).toBe(84_820);
  });
});

describe('tenant reporting excludes T01', () => {
  const tenants = tenantSummary(seedContracts);

  it('counts 20 registered tenants, not 21', () => {
    expect(tenants.registered_tenants).toBe(20);
  });

  it('counts occupants across real rooms only', () => {
    expect(tenants.total_occupants).toBe(41);
  });
});

describe('seed data policy', () => {
  it('starts on 1 Jan 2025 and covers every month through the fixture month', () => {
    expect(SEED_MONTHS[0]).toBe(SEED_START_MONTH);
    expect(SEED_MONTHS.at(-1)).toBe('2026-09-01');
    expect(SEED_MONTHS).toHaveLength(21);
  });

  it('sets every room and contract rent to 3,500 THB', () => {
    expect(seedRooms.every((room) => room.monthly_rent === SEED_MONTHLY_RENT)).toBe(true);
    expect(seedContracts.every((contract) => contract.monthly_rent === SEED_MONTHLY_RENT)).toBe(
      true,
    );
  });

  it('keeps real-room occupancy at or above 80% in every seeded month', () => {
    const realRoomCount = seedRooms.filter((room) => !room.is_test).length;
    const monthlyOccupiedRooms = SEED_MONTHS.map(
      (month) =>
        seedContracts.filter(
          (contract) =>
            !contract.is_test && contract.start_date <= month && contract.end_date >= month,
        ).length,
    );

    for (const [index, month] of SEED_MONTHS.entries()) {
      const occupied = monthlyOccupiedRooms[index]!;
      expect((occupied * 100) / realRoomCount, month).toBeGreaterThanOrEqual(80);
    }

    expect(new Set(monthlyOccupiedRooms).size).toBeGreaterThan(1);
    expect(Math.min(...monthlyOccupiedRooms)).toBe(20);
    expect(Math.max(...monthlyOccupiedRooms)).toBe(24);
  });

  it('has complete invoices for every occupied real room in every seeded month', () => {
    for (const month of SEED_MONTHS) {
      const occupied = seedContracts.filter(
        (contract) =>
          !contract.is_test && contract.start_date <= month && contract.end_date >= month,
      ).length;
      const invoices = seedInvoices.filter(
        (invoice) => !invoice.is_test && invoice.billing_month === month,
      );
      expect(invoices, month).toHaveLength(occupied);
    }
  });
});

describe('excludeTest', () => {
  it('drops flagged rows and keeps the rest', () => {
    expect(excludeTest([{ is_test: true }, { is_test: false }])).toEqual([{ is_test: false }]);
  });

  it('returns an empty array when everything is test data', () => {
    expect(excludeTest([{ is_test: true }])).toEqual([]);
  });
});

describe('T01 is kept off the production floor plan', () => {
  it('sits on floor 0, outside the three real floors', () => {
    const testRoom = seedRooms.find((room) => room.is_test);
    expect(testRoom?.room_number).toBe('T01');
    expect(testRoom?.floor).toBe(0);
  });

  it('leaves floors 1-3 holding only real rooms', () => {
    const onRealFloors = seedRooms.filter((room) => room.floor >= 1 && room.floor <= 3);
    expect(onRealFloors).toHaveLength(24);
    expect(onRealFloors.every((room) => !room.is_test)).toBe(true);
  });

  it('spreads the 21 dorm rooms 7 per floor, plus 3 houses on floor 1', () => {
    for (const floor of [2, 3]) {
      expect(seedRooms.filter((room) => room.floor === floor)).toHaveLength(7);
    }
    // Floor 1 holds its own 7 dorm rooms plus the 3 houses (H101-H103).
    expect(seedRooms.filter((room) => room.floor === 1)).toHaveLength(10);
  });
});

describe('the reporting layer cannot reach a base table', () => {
  const queriesSource = readRepoFile('./queries.ts');

  it('only ever selects from report_* views', () => {
    const tables = [...queriesSource.matchAll(/\.from\(\s*'([^']+)'\s*\)/g)].map(
      (match) => match[1]!,
    );

    expect(tables.length).toBeGreaterThan(5);
    for (const table of tables) {
      expect(table, `reporting/queries.ts must not query "${table}" directly`).toMatch(/^report_/);
    }
  });

  it('never uses the service-role client, which bypasses RLS', () => {
    expect(queriesSource).not.toContain('createAdminClient');
    expect(queriesSource).not.toContain('supabase/admin');
  });
});

describe('the SQL enforces exclusion, not just the TypeScript', () => {
  const views = readRepoFile('../../../supabase/migrations/0006_views.sql');
  const businessOverview = readRepoFile('../../../supabase/migrations/0023_business_overview.sql');
  const segments = readRepoFile('../../../supabase/migrations/0024_property_segments.sql');
  const tables = readRepoFile('../../../supabase/migrations/0002_core_tables.sql');
  const triggers = readRepoFile('../../../supabase/migrations/0005_functions_and_triggers.sql');

  const assertReportViewsFilterTestData = (migration: string, atLeast: number) => {
    const definitions = migration
      .split(/create (?:or replace )?view /)
      .filter((chunk) => chunk.startsWith('report_'));

    expect(definitions.length).toBeGreaterThanOrEqual(atLeast);
    for (const definition of definitions) {
      const name = definition.slice(0, definition.indexOf(' '));
      // Either it filters directly, or it builds on a view that already does.
      const filtersDirectly = /is_test\s*=\s*false/.test(definition);
      const buildsOnFilteredView = /from report_/.test(definition);
      expect(
        filtersDirectly || buildsOnFilteredView,
        `view ${name} neither filters is_test nor derives from a report_ view`,
      ).toBe(true);
    }
  };

  it('filters is_test in every report_ view definition', () => {
    assertReportViewsFilterTestData(views, 9);
  });

  it('filters is_test in every per-segment report_ view', () => {
    assertReportViewsFilterTestData(segments, 9);
  });

  it('constrains test rooms to floor 0 and real rooms to floors 1-3', () => {
    expect(tables).toContain('rooms_test_floor_ck');
    expect(tables).toMatch(/is_test = false and floor between 1 and 3/);
    expect(tables).toMatch(/is_test = true and floor = 0/);
  });

  it('forces child rows to inherit is_test from their room', () => {
    expect(triggers).toContain('inherit_is_test_from_room');
    for (const table of [
      'contracts_inherit_is_test',
      'access_cards_inherit_is_test',
      'meter_readings_inherit_is_test',
      'invoices_inherit_is_test',
      'maintenance_inherit_is_test',
      'payments_inherit_is_test',
    ]) {
      expect(triggers).toContain(table);
    }
  });

  it('blocks a test tenant from being contracted to a real room', () => {
    expect(triggers).toContain('enforce_contract_tenant_test_match');
  });

  it('filters test data from every business-overview source', () => {
    expect(businessOverview).toContain('report_business_overview');
    expect(businessOverview.match(/is_test = false/g)).toHaveLength(7);
  });

  it('derives the property segment from room_type rather than storing it', () => {
    expect(segments).toContain('create function room_property_segment(p_room_type room_type)');
    expect(segments).not.toMatch(/alter table rooms add column .*segment/);
  });
});
