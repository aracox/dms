import { sumMoney } from '@/lib/billing/money';
import type { CommonExpenseCategory, ExpenseMonthRow } from '@/types/database';

/** The six recurring shared costs, in the expenses page's card order. */
export const RECURRING_CATEGORIES = [
  'common_electricity',
  'common_water',
  'housekeeping',
  'gardening',
  'internet',
  'transformer_fee',
] as const satisfies readonly CommonExpenseCategory[];

/** Every category, recurring first then non-recurring. */
const CATEGORIES: readonly CommonExpenseCategory[] = [...RECURRING_CATEGORIES, 'other'];

export interface ExpenseMonth {
  month: string;
  /** The six shared costs together. */
  recurring: number;
  /** Non-recurring ('other') expenses. */
  adHoc: number;
  total: number;
  /** The month per category, zero-filled -- feeds the donut when a month is picked. */
  categories: Record<CommonExpenseCategory, number>;
}

export interface ExpenseYearReport {
  /** Gregorian year shown. */
  year: number;
  /** Years that have any month in the data, oldest first -- the year navigator's range. */
  years: number[];
  /** January to December of `year` -- the chart's x-axis. */
  months: ExpenseMonth[];
  yearTotal: number;
  adHocTotal: number;
  /** Mean over the months that have any expense; 0 when none do. */
  monthlyAverage: number;
  monthsWithData: number;
  /** The costliest month, or null when the year has nothing recorded. */
  highestMonth: ExpenseMonth | null;
  /** The whole year per category, zero-filled -- the donut's default view. */
  categories: Record<CommonExpenseCategory, number>;
}

const yearOf = (month: string) => Number(month.slice(0, 4));

/**
 * Shapes report_expense_months into one calendar year of the reports page.
 * `year` is clamped into the years the data covers (plus the current year),
 * so a stale or hand-typed ?year= still lands on a real page.
 */
export function buildExpenseYearReport(
  rows: readonly ExpenseMonthRow[],
  requestedYear: number,
  currentYear: number,
): ExpenseYearReport {
  const years = [...new Set([...rows.map((row) => yearOf(row.billing_month)), currentYear])].sort(
    (a, b) => a - b,
  );
  const year = Math.min(Math.max(requestedYear, years[0]!), years.at(-1)!);

  const inYear = rows.filter((row) => yearOf(row.billing_month) === year);
  const months = Array.from({ length: 12 }, (_, index): ExpenseMonth => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}-01`;
    const entries = inYear.filter((row) => row.billing_month === month);
    const recurring = sumMoney(
      entries.filter((row) => row.category !== 'other').map((row) => Number(row.amount)),
    );
    const adHoc = sumMoney(
      entries.filter((row) => row.category === 'other').map((row) => Number(row.amount)),
    );
    const categories = Object.fromEntries(
      CATEGORIES.map((category) => [
        category,
        sumMoney(
          entries.filter((row) => row.category === category).map((row) => Number(row.amount)),
        ),
      ]),
    ) as Record<CommonExpenseCategory, number>;
    return { month, recurring, adHoc, total: sumMoney([recurring, adHoc]), categories };
  });

  const yearTotal = sumMoney(months.map((month) => month.total));
  const withData = months.filter((month) => month.total > 0);

  return {
    year,
    years,
    months,
    yearTotal,
    adHocTotal: sumMoney(months.map((month) => month.adHoc)),
    monthlyAverage:
      withData.length === 0 ? 0 : Math.round((yearTotal / withData.length) * 100) / 100,
    monthsWithData: withData.length,
    highestMonth: withData.reduce<ExpenseMonth | null>(
      (best, month) => (best === null || month.total > best.total ? month : best),
      null,
    ),
    categories: Object.fromEntries(
      CATEGORIES.map((category) => [
        category,
        sumMoney(months.map((month) => month.categories[category])),
      ]),
    ) as Record<CommonExpenseCategory, number>,
  };
}
