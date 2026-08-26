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
import { bangkokToday, type IsoDate } from '@/lib/utils/date';

import { multiplyMoney, round2, subtractMoney, sumMoney } from './money';

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
}): InvoiceStatus {
  const { currentStatus, total, paid, dueDate } = input;
  const today = input.today ?? bangkokToday();

  // Drafts and cancelled invoices keep their status; only totals refresh.
  if (currentStatus === 'draft' || currentStatus === 'cancelled') {
    return currentStatus;
  }

  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  if (dueDate < today) return 'overdue';
  return 'issued';
}

/** Mirrors the financial_status expression in v_room_board. */
export function deriveFinancialStatus(input: {
  invoiceStatus: InvoiceStatus | null;
  dueDate: IsoDate | null;
  today?: IsoDate;
}): FinancialStatus {
  const { invoiceStatus, dueDate } = input;
  const today = input.today ?? bangkokToday();

  if (!invoiceStatus || !dueDate) return 'none';
  if (invoiceStatus === 'paid') return 'paid';
  if (invoiceStatus === 'cancelled' || invoiceStatus === 'draft') return 'none';
  return dueDate < today ? 'overdue' : 'payment_due';
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
