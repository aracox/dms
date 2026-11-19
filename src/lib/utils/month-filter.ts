/**
 * URL state for the month search on list pages (meters, billing, payments,
 * expenses). See `components/ui/MonthFilter.tsx` for the control itself.
 */

import type { ContractStatus } from '@/types/database';

import { billingMonthOf, type IsoDate } from './date';

export type SearchParam = string | string[] | undefined;

export function firstParam(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `?year=2026&month=10` -> '2026-10-01'. Null when either part is missing or
 * malformed (the page then shows its default); a future month is clamped to
 * `current`.
 */
export function parseMonthParams(
  yearParam: SearchParam,
  monthParam: SearchParam,
  current: IsoDate,
): IsoDate | null {
  const year = firstParam(yearParam);
  const month = Number(firstParam(monthParam));
  if (!year || !/^\d{4}$/.test(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  const picked = `${year}-${String(month).padStart(2, '0')}-01`;
  return picked > current ? current : picked;
}

/**
 * The query string for a month search plus its other filters (e.g. a room).
 * `defaultMonth` is what the page shows with no month in the URL, so it is
 * left out, as are filters with no value.
 */
export function monthQuery(
  month: IsoDate,
  defaultMonth: IsoDate,
  filters: Record<string, string | undefined> = {},
): Record<string, string> {
  return {
    ...(month === defaultMonth
      ? {}
      : { year: month.slice(0, 4), month: String(Number(month.slice(5, 7))) }),
    ...Object.fromEntries(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  };
}

/**
 * Whether a month's list includes a room: any room with a record (a reading, a
 * bill) that month, plus every active contract that had started by then. So a
 * past month keeps a room whose tenant has since moved out, and a later
 * move-in is not flagged as missing.
 */
export function isRoomForMonth(
  room: { contract_status: ContractStatus | null; start_date: IsoDate | null },
  hasRecord: boolean,
  month: IsoDate,
) {
  if (hasRecord) return true;
  if (room.contract_status !== 'active') return false;
  return room.start_date === null || billingMonthOf(room.start_date) <= month;
}
