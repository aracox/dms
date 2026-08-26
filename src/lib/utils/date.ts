/**
 * Date handling.
 *
 * Vercel runs in UTC; the dormitory is in UTC+7. A bare `new Date()` files
 * late-evening Bangkok activity under the previous day and can bill the wrong
 * month, so business dates always go through this module.
 *
 * Calendar dates are plain 'YYYY-MM-DD' strings, matching PostgreSQL `date`.
 * They sort and compare correctly as strings, and carry no timezone to lose.
 */

export const BANGKOK_TZ = 'Asia/Bangkok';

/** 'YYYY-MM-DD' — a PostgreSQL `date`. */
export type IsoDate = string;

const ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Thailand. */
export function bangkokToday(now: Date = new Date()): IsoDate {
  return ISO_DATE_FORMATTER.format(now);
}

/** First day of the month containing `date`. Matches invoices.billing_month. */
export function billingMonthOf(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** The current billing month in Thailand. */
export function currentBillingMonth(now: Date = new Date()): IsoDate {
  return billingMonthOf(bangkokToday(now));
}

/** Shift a billing month by whole months. `addMonths('2026-08-01', -1)` -> '2026-07-01'. */
export function addMonths(month: IsoDate, delta: number): IsoDate {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + delta;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
}

/**
 * Whole days from `from` to `to`. Negative when `to` is earlier.
 * Uses UTC noon so a DST-free +07:00 offset cannot shift the result.
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / MS_PER_DAY);
}

/** True when `dueDate` is strictly before `today`. Mirrors recalc_invoice(). */
export function isPastDue(dueDate: IsoDate, today: IsoDate = bangkokToday()): boolean {
  return dueDate < today;
}

/** Due date for a billing month, clamping to the last day of short months. */
export function dueDateFor(billingMonth: IsoDate, paymentDueDay: number): IsoDate {
  const year = Number(billingMonth.slice(0, 4));
  const month = Number(billingMonth.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(paymentDueDay, 1), lastDay);
  return `${billingMonth.slice(0, 7)}-${String(day).padStart(2, '0')}`;
}

const DATE_STYLES: Record<'th' | 'en', Intl.DateTimeFormatOptions> = {
  // Thai users expect the Buddhist calendar in day/month/year order.
  th: { timeZone: BANGKOK_TZ, dateStyle: 'medium' },
  en: { timeZone: BANGKOK_TZ, dateStyle: 'medium' },
};

/** Display a calendar date in the user's locale (Buddhist era for Thai). */
export function formatDate(date: IsoDate | null | undefined, locale: 'th' | 'en'): string {
  if (!date) return '-';
  const intlLocale = locale === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB';
  return new Intl.DateTimeFormat(intlLocale, DATE_STYLES[locale]).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/** Display a billing month, e.g. 'ส.ค. 2569' / 'Aug 2026'. */
export function formatBillingMonth(month: IsoDate | null | undefined, locale: 'th' | 'en'): string {
  if (!month) return '-';
  const intlLocale = locale === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB';
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: BANGKOK_TZ,
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${month}T12:00:00Z`));
}
