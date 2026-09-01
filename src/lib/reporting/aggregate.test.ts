import { describe, expect, it } from 'vitest';

import { financeSummary } from './aggregate';
import { SEED_TODAY, seedContracts, seedInvoices, seedPayments } from './fixtures';

describe('financeSummary payment_grace_days', () => {
  const input = { contracts: seedContracts, invoices: seedInvoices, payments: seedPayments };

  it('reports the same overdue total as no grace period when graceDays is omitted', () => {
    expect(financeSummary({ ...input, today: SEED_TODAY }).overdue).toBe(9_040);
  });

  it('still counts an invoice overdue while its due date is within the grace window', () => {
    // 104 and 203 are both due 2026-08-05, 21 days before SEED_TODAY (2026-08-26).
    expect(financeSummary({ ...input, today: SEED_TODAY, graceDays: 20 }).overdue).toBe(9_040);
  });

  it('drops out of overdue once the grace period covers the gap to today', () => {
    expect(financeSummary({ ...input, today: SEED_TODAY, graceDays: 21 }).overdue).toBe(0);
  });
});
