import { describe, expect, it } from 'vitest';

import { financeSummary } from './aggregate';
import { SEED_TODAY, seedContracts, seedInvoices, seedPayments } from './fixtures';

describe('financeSummary payment_grace_days', () => {
  const input = { contracts: seedContracts, invoices: seedInvoices, payments: seedPayments };

  it('reports the same overdue total as no grace period when graceDays is omitted', () => {
    expect(financeSummary({ ...input, today: SEED_TODAY }).overdue).toBe(6_440);
  });

  it('still counts an invoice overdue while its due date is within the grace window', () => {
    // The two open invoices were due yesterday, so a zero-day grace still leaves them overdue.
    expect(financeSummary({ ...input, today: SEED_TODAY, graceDays: 0 }).overdue).toBe(6_440);
  });

  it('drops out of overdue once the grace period covers the gap to today', () => {
    expect(financeSummary({ ...input, today: SEED_TODAY, graceDays: 1 }).overdue).toBe(0);
  });
});
