/**
 * Invoice and meter arithmetic.
 *
 * These functions MIRROR the database, they do not replace it. The generated
 * columns and triggers in migration 0005 are authoritative; this module exists
 * so the UI can preview an invoice before it is written, and so the rules are
 * unit-testable without a database.
 *
 * If you change a rule here, change it in 0005 too -- and vice versa.
 */

import type { FinancialStatus, InvoiceItemType, InvoiceStatus } from '@/types/database';
import {
  addDays,
  addMonths,
  bangkokToday,
  billingMonthOf,
  daysBetween,
  isPastDue,
  type IsoDate,
} from '@/lib/utils/date';

import { fromSatang, multiplyMoney, round2, subtractMoney, sumMoney, toSatang } from './money';

export class MeterReadingError extends Error {}

/**
 * Mirrors the meter_readings.usage generated column, plus the
 * meter_readings_not_reversed_ck constraint.
 */
export function meterUsage(previousReading: number, currentReading: number): number {
  if (currentReading < previousReading) {
    throw new MeterReadingError(
      `Current reading ${currentReading} is below previous reading ${previousReading}`,
    );
  }
  return round2(subtractMoney(currentReading, previousReading));
}

/** Mirrors the meter_readings.amount generated column. */
export function meterAmount(previousReading: number, currentReading: number, rate: number): number {
  return multiplyMoney(meterUsage(previousReading, currentReading), rate);
}

export interface InvoiceItemInput {
  type: InvoiceItemType;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  total: number;
}

/** Mirrors the invoice_items.amount generated column. */
export function invoiceItemAmount(item: InvoiceItemInput): number {
  return multiplyMoney(item.quantity, item.unitPrice);
}

/**
 * Mirrors recalc_invoice(): subtotal is everything except discounts, discounts
 * are stored positive and subtracted.
 */
export function invoiceTotals(items: readonly InvoiceItemInput[]): InvoiceTotals {
  const charges = items.filter((item) => item.type !== 'discount');
  const discounts = items.filter((item) => item.type === 'discount');

  const subtotal = sumMoney(charges.map(invoiceItemAmount));
  const discount = sumMoney(discounts.map(invoiceItemAmount));

  if (discount > subtotal) {
    throw new RangeError(`Discount ${discount} exceeds subtotal ${subtotal}`);
  }

  return { subtotal, discount, total: subtractMoney(subtotal, discount) };
}

export interface PaymentInput {
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

/** Only confirmed payments settle an invoice. Mirrors recalc_invoice(). */
export function confirmedPaid(payments: readonly PaymentInput[]): number {
  return sumMoney(
    payments.filter((payment) => payment.status === 'confirmed').map((payment) => payment.amount),
  );
}

/** Remaining balance, never negative. */
export function outstanding(total: number, paid: number): number {
  const remaining = subtractMoney(total, paid);
  return remaining > 0 ? remaining : 0;
}

/** Bills that still expect money: what settle_deposit (0045) pays from a deposit. */
export const OWING_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'issued',
  'overdue',
  'partially_paid',
];

/**
 * What a tenant still owes across their bills: the unpaid balance of every bill
 * that expects money. Drafts and cancelled bills owe nothing.
 */
export function amountOwed(
  invoices: readonly { status: InvoiceStatus; total: number; payments: readonly PaymentInput[] }[],
): number {
  return sumMoney(
    invoices
      .filter((invoice) => OWING_INVOICE_STATUSES.includes(invoice.status))
      .map((invoice) => outstanding(invoice.total, confirmedPaid(invoice.payments))),
  );
}

/**
 * Mirrors the status branch of recalc_invoice(), including its precedence:
 * paid beats partially_paid beats overdue. A partly-paid invoice past its due
 * date reads as partially_paid, not overdue.
 */
export function deriveInvoiceStatus(input: {
  currentStatus: InvoiceStatus;
  total: number;
  paid: number;
  dueDate: IsoDate;
  today?: IsoDate;
  /** Days past due_date before the invoice counts as overdue. Mirrors payment_grace_days(). */
  graceDays?: number;
}): InvoiceStatus {
  const { currentStatus, total, paid, dueDate, graceDays = 0 } = input;
  const today = input.today ?? bangkokToday();

  // Drafts and cancelled invoices keep their status; only totals refresh.
  if (currentStatus === 'draft' || currentStatus === 'cancelled') {
    return currentStatus;
  }

  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  if (isPastDue(dueDate, today, graceDays)) return 'overdue';
  return 'issued';
}

/** Mirrors the financial_status expression in v_room_board. */
export function deriveFinancialStatus(input: {
  invoiceStatus: InvoiceStatus | null;
  dueDate: IsoDate | null;
  today?: IsoDate;
  /** Days past due_date before the invoice counts as overdue. Mirrors payment_grace_days(). */
  graceDays?: number;
  /** The active contract's start_date; a contract started this month is 'first_month'. */
  contractStartDate?: IsoDate | null;
}): FinancialStatus {
  const { invoiceStatus, dueDate, graceDays = 0, contractStartDate } = input;
  const today = input.today ?? bangkokToday();

  if (!invoiceStatus) {
    return contractStartDate && contractStartDate >= billingMonthOf(today) ? 'first_month' : 'none';
  }
  if (!dueDate) return 'none';
  if (invoiceStatus === 'paid') return 'paid';
  if (invoiceStatus === 'cancelled' || invoiceStatus === 'draft') return 'none';
  return isPastDue(dueDate, today, graceDays) ? 'overdue' : 'payment_due';
}

/**
 * Guard mirroring the overpayment check in recalc_invoice(). Call before
 * submitting a payment so the user gets a message instead of a database error.
 */
export function validatePaymentAmount(input: {
  amount: number;
  invoiceTotal: number;
  alreadyPaid: number;
}): { ok: true } | { ok: false; reason: 'not_positive' | 'exceeds_total'; maxAllowed: number } {
  const maxAllowed = outstanding(input.invoiceTotal, input.alreadyPaid);

  if (input.amount <= 0) return { ok: false, reason: 'not_positive', maxAllowed };
  if (input.amount > maxAllowed) return { ok: false, reason: 'exceeds_total', maxAllowed };
  return { ok: true };
}

export interface MonthRent {
  amount: number;
  /** Days of the month the contract covers. */
  days: number;
  daysInMonth: number;
  /** First and last day billed, so a part month can say which days it covers. */
  from: IsoDate;
  to: IsoDate;
}

/**
 * Rent a contract owes for one billing month, prorated by days for the month
 * it starts in and the month it ends in: monthly rent x days covered / days in
 * the month, rounded to the satang. A month the contract covers fully is the
 * plain monthly rent. `endedOn` is the contract's last day, or null while it
 * runs on (see contractEndedOn).
 */
export function rentForMonth(input: {
  monthlyRent: number;
  billingMonth: IsoDate;
  startDate: IsoDate;
  endedOn: IsoDate | null;
}): MonthRent {
  const monthStart = billingMonthOf(input.billingMonth);
  const monthEnd = addDays(addMonths(monthStart, 1), -1);
  const daysInMonth = daysBetween(monthStart, monthEnd) + 1;
  const from = input.startDate > monthStart ? input.startDate : monthStart;
  const to = input.endedOn !== null && input.endedOn < monthEnd ? input.endedOn : monthEnd;
  const days = Math.max(daysBetween(from, to) + 1, 0);

  const amount =
    days >= daysInMonth
      ? input.monthlyRent
      : fromSatang(Math.round((toSatang(input.monthlyRent) * days) / daysInMonth));

  return { amount, days, daysInMonth, from, to };
}

/**
 * "20/11–30/11 (11/30)": the days a prorated rent line covers, stored as the
 * line's description. Numbers only, so it reads the same in either language.
 */
export function rentPeriodLabel(rent: Pick<MonthRent, 'from' | 'to' | 'days' | 'daysInMonth'>) {
  const dayMonth = (date: IsoDate) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
  return `${dayMonth(rent.from)}–${dayMonth(rent.to)} (${rent.days}/${rent.daysInMonth})`;
}

/**
 * Build the standard monthly invoice lines for a room: rent, then metered
 * utilities, then any fixed extras. The caller supplies the readings so this
 * stays a pure function.
 */
export function buildMonthlyInvoiceItems(input: {
  monthlyRent: number;
  electricity?: { previousReading: number; currentReading: number; rate: number };
  water?: { previousReading: number; currentReading: number; rate: number };
  extras?: readonly { type: InvoiceItemType; quantity: number; unitPrice: number }[];
}): InvoiceItemInput[] {
  const items: InvoiceItemInput[] = [{ type: 'rent', quantity: 1, unitPrice: input.monthlyRent }];

  if (input.electricity) {
    const { previousReading, currentReading, rate } = input.electricity;
    const usage = meterUsage(previousReading, currentReading);
    if (usage > 0) items.push({ type: 'electricity', quantity: usage, unitPrice: rate });
  }

  if (input.water) {
    const { previousReading, currentReading, rate } = input.water;
    const usage = meterUsage(previousReading, currentReading);
    if (usage > 0) items.push({ type: 'water', quantity: usage, unitPrice: rate });
  }

  if (input.extras) items.push(...input.extras);

  return items;
}
