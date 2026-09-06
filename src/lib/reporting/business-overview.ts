import { round2 } from '@/lib/billing/money';
import type { BusinessOverviewRow } from '@/types/database';

export function chartHeight(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return 0;
  return Math.max(3, Math.min(100, (value * 100) / maximum));
}

export function summarizeBusinessOverview(rows: BusinessOverviewRow[]) {
  const latest = rows.at(-1) ?? null;
  const averageOccupancy =
    rows.length === 0
      ? 0
      : round2(rows.reduce((sum, row) => sum + row.occupancy_rate, 0) / rows.length);

  return { latest, averageOccupancy };
}
