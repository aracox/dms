import { describe, expect, it } from 'vitest';

import type { CommonExpenseCategory, ExpenseMonthRow } from '@/types/database';

import { buildExpenseYearReport } from './expenses';

const row = (
  billing_month: string,
  category: CommonExpenseCategory,
  amount: number,
): ExpenseMonthRow => ({ billing_month, category, amount, entry_count: amount > 0 ? 1 : 0 });

const rows = [
  row('2025-12-01', 'housekeeping', 4000),
  row('2026-08-01', 'common_electricity', 4000),
  row('2026-08-01', 'other', 0),
  row('2026-09-01', 'common_electricity', 4900),
  row('2026-09-01', 'housekeeping', 4000),
  row('2026-09-01', 'other', 1000),
  row('2026-10-01', 'housekeeping', 5000),
];

describe('buildExpenseYearReport', () => {
  it('lays out January to December of the year, zero-filled', () => {
    const report = buildExpenseYearReport(rows, 2026, 2026);
    expect(report.months).toHaveLength(12);
    expect(report.months[0]).toMatchObject({
      month: '2026-01-01',
      recurring: 0,
      adHoc: 0,
      total: 0,
    });
    expect(report.months[8]).toMatchObject({
      month: '2026-09-01',
      recurring: 8900,
      adHoc: 1000,
      total: 9900,
    });
  });

  it('splits each month by category, zero-filling the rest', () => {
    const september = buildExpenseYearReport(rows, 2026, 2026).months[8]!;
    expect(september.categories).toEqual({
      common_electricity: 4900,
      common_water: 0,
      housekeeping: 4000,
      gardening: 0,
      internet: 0,
      transformer_fee: 0,
      other: 1000,
    });
  });

  it('totals the year and averages over months that have data', () => {
    const report = buildExpenseYearReport(rows, 2026, 2026);
    expect(report.yearTotal).toBe(18900);
    expect(report.adHocTotal).toBe(1000);
    expect(report.monthsWithData).toBe(3);
    expect(report.monthlyAverage).toBe(6300);
    expect(report.highestMonth?.month).toBe('2026-09-01');
  });

  it('totals the year per category, zero-filled', () => {
    const report = buildExpenseYearReport(rows, 2026, 2026);
    expect(report.categories).toEqual({
      common_electricity: 8900,
      common_water: 0,
      housekeeping: 9000,
      gardening: 0,
      internet: 0,
      transformer_fee: 0,
      other: 1000,
    });
  });

  it('keeps each year separate and lists the years for navigation', () => {
    const report = buildExpenseYearReport(rows, 2025, 2026);
    expect(report.years).toEqual([2025, 2026]);
    expect(report.yearTotal).toBe(4000);
    expect(report.highestMonth?.month).toBe('2025-12-01');
  });

  it('clamps a year outside the data onto the nearest real one', () => {
    expect(buildExpenseYearReport(rows, 2019, 2026).year).toBe(2025);
    expect(buildExpenseYearReport(rows, 2031, 2026).year).toBe(2026);
  });

  it('handles a year with nothing recorded', () => {
    const report = buildExpenseYearReport([], 2026, 2026);
    expect(report.yearTotal).toBe(0);
    expect(report.monthlyAverage).toBe(0);
    expect(report.highestMonth).toBeNull();
    expect(Object.values(report.categories).every((amount) => amount === 0)).toBe(true);
  });
});
