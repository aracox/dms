import { round2 } from '@/lib/billing/money';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import type {
  BusinessOverviewBySegmentRow,
  BusinessOverviewRow,
  PropertySegment,
} from '@/types/database';

export function chartHeight(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return 0;
  return Math.max(3, Math.min(100, (value * 100) / maximum));
}

/** One slice's share of a stacked bar. Unclamped -- the slices must sum to 100. */
export function stackShare(value: number, total: number) {
  if (value <= 0 || total <= 0) return 0;
  return (value * 100) / total;
}

export function summarizeBusinessOverview(rows: BusinessOverviewRow[]) {
  const latest = rows.at(-1) ?? null;
  const averageOccupancy =
    rows.length === 0
      ? 0
      : round2(rows.reduce((sum, row) => sum + row.occupancy_rate, 0) / rows.length);

  return { latest, averageOccupancy };
}

/** A month's whole-property figures alongside each segment's own. */
export interface SegmentedOverviewMonth {
  billing_month: string;
  total: BusinessOverviewRow;
  segments: Record<PropertySegment, BusinessOverviewBySegmentRow>;
}

const emptySegmentRow = (
  billingMonth: string,
  segment: PropertySegment,
): BusinessOverviewBySegmentRow => ({
  billing_month: billingMonth,
  segment,
  occupied_rooms: 0,
  total_rooms: 0,
  occupancy_rate: 0,
  billed_amount: 0,
  collected_amount: 0,
  collection_rate: 0,
});

/**
 * Zip the whole-property trend with the per-segment one, month by month.
 *
 * The whole-property rows drive the month axis: they are the ones that carry
 * building-wide common expenses, which no segment can claim.
 */
export function mergeOverviewSegments(
  rows: readonly BusinessOverviewRow[],
  segmentRows: readonly BusinessOverviewBySegmentRow[],
): SegmentedOverviewMonth[] {
  return rows.map((total) => ({
    billing_month: total.billing_month,
    total,
    segments: Object.fromEntries(
      PROPERTY_SEGMENTS.map((segment) => [
        segment,
        segmentRows.find(
          (row) => row.billing_month === total.billing_month && row.segment === segment,
        ) ?? emptySegmentRow(total.billing_month, segment),
      ]),
    ) as Record<PropertySegment, BusinessOverviewBySegmentRow>,
  }));
}

/** Average and current-month occupancy for each segment. */
export function summarizeSegmentOccupancy(months: readonly SegmentedOverviewMonth[]) {
  const summary = {} as Record<PropertySegment, { average: number; current: number }>;

  for (const segment of PROPERTY_SEGMENTS) {
    const rates = months.map((month) => month.segments[segment].occupancy_rate);
    summary[segment] = {
      average:
        rates.length === 0 ? 0 : round2(rates.reduce((sum, rate) => sum + rate, 0) / rates.length),
      current: rates.at(-1) ?? 0,
    };
  }

  return summary;
}
