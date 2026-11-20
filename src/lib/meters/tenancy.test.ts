import { describe, expect, it } from 'vitest';

import {
  finalMeterLabel,
  finalMeterUsage,
  hasFinalMeterNumber,
  lastMeterNumber,
  type MeterContract,
} from './tenancy';

const contract = (overrides: Partial<MeterContract>): MeterContract => ({
  id: 'c',
  status: 'active',
  start_date: '2026-01-01',
  terminated_at: null,
  meter_start_electricity: null,
  meter_start_water: null,
  meter_end_electricity: null,
  meter_end_water: null,
  ...overrides,
});

const reading = (billing_month: string, current_reading: number) => ({
  billing_month,
  meter_type: 'electricity' as const,
  current_reading,
});

describe('lastMeterNumber', () => {
  it('is null when nothing is known -- never 0', () => {
    expect(
      lastMeterNumber({ type: 'electricity', readings: [], contracts: [], through: '2026-11-30' }),
    ).toBeNull();
  });

  it('starts a new tenant from their move-in number', () => {
    const tenant = contract({ start_date: '2026-11-21', meter_start_electricity: 12_150 });
    expect(
      lastMeterNumber({
        type: 'electricity',
        readings: [],
        contracts: [tenant],
        through: '2026-11-30',
      }),
    ).toBe(12_150);
  });

  it('takes the latest of readings, move-outs and move-ins', () => {
    const outgoing = contract({
      id: 'old',
      status: 'terminated',
      start_date: '2025-01-01',
      terminated_at: '2026-11-20',
      meter_end_electricity: 1_100,
    });
    const incoming = contract({
      id: 'new',
      start_date: '2026-11-21',
      meter_start_electricity: 1_101,
    });
    const readings = [reading('2026-10-01', 1_000)];

    expect(
      lastMeterNumber({
        type: 'electricity',
        readings,
        contracts: [incoming, outgoing],
        through: '2026-11-30',
      }),
    ).toBe(1_101);
    expect(
      lastMeterNumber({
        type: 'electricity',
        readings,
        contracts: [incoming, outgoing],
        through: '2026-11-20',
      }),
    ).toBe(1_100);
    expect(
      lastMeterNumber({
        type: 'electricity',
        readings,
        contracts: [incoming, outgoing],
        through: '2026-11-19',
      }),
    ).toBe(1_000);
  });

  it("does not count a month's own reading on that month's last day", () => {
    expect(
      lastMeterNumber({
        type: 'electricity',
        readings: [reading('2026-10-01', 1_000), reading('2026-11-01', 1_090)],
        contracts: [],
        through: '2026-11-30',
      }),
    ).toBe(1_000);
  });

  it('ignores the other meter', () => {
    expect(
      lastMeterNumber({
        type: 'water',
        readings: [reading('2026-10-01', 1_000)],
        contracts: [],
        through: '2026-11-30',
      }),
    ).toBeNull();
  });
});

describe('finalMeterUsage', () => {
  const outgoing = contract({
    id: 'old',
    status: 'terminated',
    start_date: '2025-01-01',
    terminated_at: '2026-11-20',
    meter_end_electricity: 1_060,
  });

  it('counts from the last reading to the move-out number', () => {
    expect(
      finalMeterUsage({
        contract: outgoing,
        type: 'electricity',
        billingMonth: '2026-11-01',
        readings: [reading('2026-10-01', 1_000)],
        contracts: [outgoing],
      }),
    ).toEqual({ previousReading: 1_000, currentReading: 1_060 });
  });

  it('counts from the move-in number for a stay inside one month', () => {
    const short = contract({
      ...outgoing,
      start_date: '2026-11-05',
      meter_start_electricity: 1_010,
    });
    expect(
      finalMeterUsage({
        contract: short,
        type: 'electricity',
        billingMonth: '2026-11-01',
        readings: [reading('2026-10-01', 1_000)],
        contracts: [short],
      }),
    ).toEqual({ previousReading: 1_010, currentReading: 1_060 });
  });

  it('only applies in the move-out month, and only with a final number', () => {
    const args = { readings: [reading('2026-10-01', 1_000)], contracts: [outgoing] };
    expect(
      finalMeterUsage({
        ...args,
        contract: outgoing,
        type: 'electricity',
        billingMonth: '2026-10-01',
      }),
    ).toBeUndefined();
    expect(
      finalMeterUsage({ ...args, contract: outgoing, type: 'water', billingMonth: '2026-11-01' }),
    ).toBeUndefined();
    expect(hasFinalMeterNumber(outgoing, 'electricity', '2026-11-01')).toBe(true);
    expect(hasFinalMeterNumber(outgoing, 'water', '2026-11-01')).toBe(false);
  });

  it('bills nothing when there is no number to count from', () => {
    expect(
      finalMeterUsage({
        contract: outgoing,
        type: 'electricity',
        billingMonth: '2026-11-01',
        readings: [],
        contracts: [outgoing],
      }),
    ).toBeUndefined();
  });
});

describe('finalMeterLabel', () => {
  it('shows the numbers and the move-out day', () => {
    expect(finalMeterLabel({ previousReading: 1_000, currentReading: 1_060.5 }, '2026-11-20')).toBe(
      '1,000 → 1,060.5 (20/11)',
    );
  });
});
