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
import { SEED_TODAY, seedContracts, seedInvoices, seedPayments, seedRooms } from './fixtures';

const readRepoFile = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the seed fixture actually contains test data', () => {
  // Without this, every assertion below would pass trivially.
  it('includes exactly one test room and 21 real rooms', () => {
    expect(seedRooms.filter((room) => room.is_test)).toHaveLength(1);
    expect(seedRooms.filter((room) => !room.is_test)).toHaveLength(21);
    expect(seedRooms).toHaveLength(22);
  });

  it('gives the test room a contract, an invoice and a payment', () => {
    expect(seedContracts.some((c) => c.is_test)).toBe(true);
    expect(seedInvoices.some((i) => i.is_test)).toBe(true);
    expect(seedPayments.some((p) => p.is_test)).toBe(true);
  });
});

describe('room reporting excludes T01', () => {
  const summary = roomSummary(seedRooms);

  it('counts 21 rooms, not 22', () => {
    expect(summary.total_rooms).toBe(21);
  });

  it('reports occupancy over the real rooms only', () => {
    expect(summary.occupied).toBe(9);
    expect(summary.vacant).toBe(10);
    expect(summary.reserved).toBe(1);
    expect(summary.maintenance).toBe(1);
    expect(summary.occupied + summary.vacant + summary.reserved + summary.maintenance).toBe(21);
  });

  it('computes the occupancy rate from 21', () => {
    // 9 / 21 = 42.86%. Over 22 rooms it would read 45.45%.
    expect(summary.occupancy_rate).toBeCloseTo(42.86, 2);
  });

  it('would report different numbers if T01 leaked in', () => {
    const leaked = roomSummary(seedRooms.map((room) => ({ ...room, is_test: false })));
    expect(leaked.total_rooms).toBe(22);
    expect(leaked.occupied).toBe(10);
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
    // 6,000 x 3 + 4,500 + 6,000 x 3 + 6,000 x 2 = 52,500. With T01: 59,000.
    expect(finance.expected_rent).toBe(52_500);
  });

  it('excludes the T01 invoice from the invoiced total', () => {
    expect(finance.invoiced_total).toBe(63_140);
  });

  it('excludes the T01 payment from collected revenue', () => {
    // The single most likely leak: T01 is paid in full, so a missing filter
    // silently inflates collections by 7,660.
    expect(finance.collected_this_month).toBe(46_760);
  });

  it('excludes T01 from outstanding and overdue', () => {
    // 104: 2,320 + 203: 6,720 + 302: 7,340 = 16,380
    expect(finance.outstanding).toBe(16_380);
    // Only the invoices past 2026-08-26: 104 and 203.
    expect(finance.overdue).toBe(9_040);
  });

  it('would report different numbers if T01 leaked in', () => {
    const leaked = financeSummary({
      contracts: seedContracts.map((c) => ({ ...c, is_test: false })),
      invoices: seedInvoices.map((i) => ({ ...i, is_test: false })),
      payments: seedPayments.map((p) => ({ ...p, is_test: false })),
      today: SEED_TODAY,
    });

    expect(leaked.expected_rent).toBe(59_000);
    expect(leaked.invoiced_total).toBe(70_800);
    expect(leaked.collected_this_month).toBe(54_420);
  });
});

describe('tenant reporting excludes T01', () => {
  const tenants = tenantSummary(seedContracts);

  it('counts 9 registered tenants, not 10', () => {
    expect(tenants.registered_tenants).toBe(9);
  });

  it('counts occupants across real rooms only', () => {
    // 2+1+3+2+1+2+1+2+4 = 18. With the T01 contract it would be 20.
    expect(tenants.total_occupants).toBe(18);
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
    expect(onRealFloors).toHaveLength(21);
    expect(onRealFloors.every((room) => !room.is_test)).toBe(true);
  });

  it('spreads the 21 real rooms 7 per floor', () => {
    for (const floor of [1, 2, 3]) {
      expect(seedRooms.filter((room) => room.floor === floor)).toHaveLength(7);
    }
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
  const tables = readRepoFile('../../../supabase/migrations/0002_core_tables.sql');
  const triggers = readRepoFile('../../../supabase/migrations/0005_functions_and_triggers.sql');

  it('filters is_test in every report_ view definition', () => {
    const definitions = views.split(/create view /).filter((chunk) => chunk.startsWith('report_'));

    expect(definitions.length).toBeGreaterThanOrEqual(9);
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
});
