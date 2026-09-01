import { describe, expect, it } from 'vitest';

import {
  buildMonthlyInvoiceItems,
  confirmedPaid,
  deriveFinancialStatus,
  deriveInvoiceStatus,
  invoiceItemAmount,
  invoiceTotals,
  MeterReadingError,
  meterAmount,
  meterUsage,
  outstanding,
  validatePaymentAmount,
} from './calc';
import { formatTHB, round2, sumMoney } from './money';

describe('meter readings', () => {
  it('computes usage as current minus previous', () => {
    expect(meterUsage(1250, 1380)).toBe(130);
    expect(meterUsage(220, 226)).toBe(6);
  });

  it('allows a zero-usage month', () => {
    expect(meterUsage(500, 500)).toBe(0);
  });

  it('rejects a reading below the previous one', () => {
    expect(() => meterUsage(1380, 1250)).toThrow(MeterReadingError);
  });

  it('bills usage at the given rate', () => {
    // The T01 defaults from the specification.
    expect(meterAmount(1250, 1380, 8)).toBe(1040);
    expect(meterAmount(220, 226, 20)).toBe(120);
  });

  it('rounds fractional rates to satang', () => {
    expect(meterAmount(0, 3, 8.335)).toBe(25.01); // 25.005 rounds half away from zero
  });
});

describe('money', () => {
  it('does not drift on repeated addition', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(Array.from({ length: 10 }, () => 0.1))).toBe(1);
  });

  it('rounds half away from zero, like PostgreSQL round(numeric, 2)', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
  });

  it('formats Thai baht', () => {
    expect(formatTHB(6500, 'en')).toBe('฿6,500.00');
  });
});

describe('invoice totals', () => {
  const t01Items = buildMonthlyInvoiceItems({
    monthlyRent: 6500,
    electricity: { previousReading: 1250, currentReading: 1380, rate: 8 },
    water: { previousReading: 220, currentReading: 226, rate: 20 },
  });

  it('reproduces the T01 example invoice from the specification', () => {
    // Rent 6,500 + Electricity 1,040 + Water 120 = 7,660
    expect(invoiceItemAmount(t01Items[0]!)).toBe(6500);
    expect(invoiceItemAmount(t01Items[1]!)).toBe(1040);
    expect(invoiceItemAmount(t01Items[2]!)).toBe(120);
    expect(invoiceTotals(t01Items)).toEqual({ subtotal: 7660, discount: 0, total: 7660 });
  });

  it('omits a utility line when usage is zero', () => {
    const items = buildMonthlyInvoiceItems({
      monthlyRent: 4500,
      electricity: { previousReading: 900, currentReading: 900, rate: 8 },
      water: { previousReading: 60, currentReading: 64, rate: 20 },
    });
    expect(items.map((item) => item.type)).toEqual(['rent', 'water']);
  });

  it('subtracts discounts from the subtotal', () => {
    const totals = invoiceTotals([
      { type: 'rent', quantity: 1, unitPrice: 6000 },
      { type: 'internet', quantity: 1, unitPrice: 200 },
      { type: 'discount', quantity: 1, unitPrice: 500 },
    ]);
    expect(totals).toEqual({ subtotal: 6200, discount: 500, total: 5700 });
  });

  it('rejects a discount larger than the subtotal', () => {
    expect(() =>
      invoiceTotals([
        { type: 'rent', quantity: 1, unitPrice: 1000 },
        { type: 'discount', quantity: 1, unitPrice: 1001 },
      ]),
    ).toThrow(RangeError);
  });
});

describe('payments and outstanding balance', () => {
  it('counts only confirmed payments', () => {
    expect(
      confirmedPaid([
        { amount: 3000, status: 'confirmed' },
        { amount: 1000, status: 'pending' },
        { amount: 500, status: 'cancelled' },
      ]),
    ).toBe(3000);
  });

  it('computes the remaining balance', () => {
    expect(outstanding(5320, 3000)).toBe(2320);
  });

  it('never reports a negative balance', () => {
    expect(outstanding(1000, 1200)).toBe(0);
  });

  it('rejects a non-positive payment', () => {
    expect(validatePaymentAmount({ amount: 0, invoiceTotal: 1000, alreadyPaid: 0 })).toEqual({
      ok: false,
      reason: 'not_positive',
      maxAllowed: 1000,
    });
  });

  it('rejects a payment beyond the outstanding balance', () => {
    expect(validatePaymentAmount({ amount: 2500, invoiceTotal: 5320, alreadyPaid: 3000 })).toEqual({
      ok: false,
      reason: 'exceeds_total',
      maxAllowed: 2320,
    });
  });

  it('accepts a payment that settles the balance exactly', () => {
    expect(validatePaymentAmount({ amount: 2320, invoiceTotal: 5320, alreadyPaid: 3000 })).toEqual({
      ok: true,
    });
  });
});

describe('invoice status', () => {
  const base = { currentStatus: 'issued' as const, dueDate: '2026-08-05', today: '2026-08-26' };

  it('marks a fully paid invoice paid', () => {
    expect(deriveInvoiceStatus({ ...base, total: 7360, paid: 7360 })).toBe('paid');
  });

  it('prefers partially_paid over overdue when something has been paid', () => {
    expect(deriveInvoiceStatus({ ...base, total: 5320, paid: 3000 })).toBe('partially_paid');
  });

  it('marks an unpaid invoice past its due date overdue', () => {
    expect(deriveInvoiceStatus({ ...base, total: 6720, paid: 0 })).toBe('overdue');
  });

  it('leaves an unpaid invoice issued while it is still current', () => {
    expect(deriveInvoiceStatus({ ...base, dueDate: '2026-08-28', total: 7340, paid: 0 })).toBe(
      'issued',
    );
  });

  it('does not promote a draft or cancelled invoice', () => {
    expect(deriveInvoiceStatus({ ...base, currentStatus: 'draft', total: 100, paid: 100 })).toBe(
      'draft',
    );
    expect(
      deriveInvoiceStatus({ ...base, currentStatus: 'cancelled', total: 100, paid: 100 }),
    ).toBe('cancelled');
  });

  it('treats a zero-total invoice as unpaid rather than paid', () => {
    expect(deriveInvoiceStatus({ ...base, total: 0, paid: 0 })).toBe('overdue');
  });

  it('holds off overdue while a grace period is still running', () => {
    // Due 2026-08-05 + 5 days grace = late only after 2026-08-10.
    expect(
      deriveInvoiceStatus({ ...base, today: '2026-08-10', total: 6720, paid: 0, graceDays: 5 }),
    ).toBe('issued');
    expect(
      deriveInvoiceStatus({ ...base, today: '2026-08-11', total: 6720, paid: 0, graceDays: 5 }),
    ).toBe('overdue');
  });
});

describe('floor plan financial status', () => {
  const today = '2026-08-26';

  it('reports none when there is no invoice', () => {
    expect(deriveFinancialStatus({ invoiceStatus: null, dueDate: null, today })).toBe('none');
  });

  it('reports paid', () => {
    expect(deriveFinancialStatus({ invoiceStatus: 'paid', dueDate: '2026-08-05', today })).toBe(
      'paid',
    );
  });

  it('reports payment_due before the due date', () => {
    expect(deriveFinancialStatus({ invoiceStatus: 'issued', dueDate: '2026-08-28', today })).toBe(
      'payment_due',
    );
  });

  it('reports overdue after the due date', () => {
    expect(deriveFinancialStatus({ invoiceStatus: 'issued', dueDate: '2026-08-05', today })).toBe(
      'overdue',
    );
  });

  it('ignores draft and cancelled invoices', () => {
    expect(deriveFinancialStatus({ invoiceStatus: 'draft', dueDate: '2026-08-05', today })).toBe(
      'none',
    );
    expect(
      deriveFinancialStatus({ invoiceStatus: 'cancelled', dueDate: '2026-08-05', today }),
    ).toBe('none');
  });

  it('holds off overdue while a grace period is still running', () => {
    expect(
      deriveFinancialStatus({
        invoiceStatus: 'issued',
        dueDate: '2026-08-05',
        today: '2026-08-10',
        graceDays: 5,
      }),
    ).toBe('payment_due');
    expect(
      deriveFinancialStatus({
        invoiceStatus: 'issued',
        dueDate: '2026-08-05',
        today: '2026-08-11',
        graceDays: 5,
      }),
    ).toBe('overdue');
  });
});
