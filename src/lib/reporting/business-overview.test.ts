import { describe, expect, it } from 'vitest';

import type { BusinessOverviewRow } from '@/types/database';

import { chartHeight, summarizeBusinessOverview } from './business-overview';

const row = (overrides: Partial<BusinessOverviewRow> = {}): BusinessOverviewRow => ({
  billing_month: '2026-09-01',
  occupied_rooms: 20,
  total_rooms: 24,
  occupancy_rate: 83.3,
  billed_amount: 86_600,
  collected_amount: 80_160,
  expense_amount: 14_850,
  net_after_expenses: 65_310,
  collection_rate: 92.6,
  ...overrides,
});

describe('business overview chart calculations', () => {
  it('summarizes the latest month and average occupancy', () => {
    const august = row({ billing_month: '2026-08-01', occupancy_rate: 81.7 });
    const september = row();

    expect(summarizeBusinessOverview([august, september])).toEqual({
      latest: september,
      averageOccupancy: 82.5,
    });
  });

  it('returns a safe empty summary', () => {
    expect(summarizeBusinessOverview([])).toEqual({ latest: null, averageOccupancy: 0 });
  });

  it('keeps positive bars visible and clamps them to the plot', () => {
    expect(chartHeight(0, 100)).toBe(0);
    expect(chartHeight(1, 100)).toBe(3);
    expect(chartHeight(50, 100)).toBe(50);
    expect(chartHeight(120, 100)).toBe(100);
  });
});
