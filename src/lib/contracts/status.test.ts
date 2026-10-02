import { describe, expect, it } from 'vitest';

import { contractDisplayStatus, contractForBillingMonth, pendingDepositSettlement } from './status';

describe('contractDisplayStatus', () => {
  it('shows a terminated contract as awaiting_refund until deposit_settled_at is set', () => {
    expect(contractDisplayStatus({ status: 'terminated', deposit_settled_at: null })).toBe(
      'awaiting_refund',
    );
  });

  it('shows a settled terminated contract as terminated', () => {
    expect(contractDisplayStatus({ status: 'terminated', deposit_settled_at: '2026-01-15' })).toBe(
      'terminated',
    );
  });

  it('passes through every other status unchanged', () => {
    expect(contractDisplayStatus({ status: 'active', deposit_settled_at: null })).toBe('active');
    expect(contractDisplayStatus({ status: 'draft', deposit_settled_at: null })).toBe('draft');
    expect(contractDisplayStatus({ status: 'expired', deposit_settled_at: null })).toBe('expired');
  });
});

describe('pendingDepositSettlement', () => {
  const active = { id: 'new', status: 'active', deposit_settled_at: null } as const;
  const unsettled = { id: 'old', status: 'terminated', deposit_settled_at: null } as const;

  it('returns the unsettled terminated contract behind a new tenant', () => {
    expect(pendingDepositSettlement([active, unsettled])).toBe(unsettled);
  });

  it('returns it for a vacant room too', () => {
    expect(pendingDepositSettlement([unsettled])).toBe(unsettled);
  });

  it('ignores an unsettled contract that is not the most recent past one', () => {
    const settled = { id: 'mid', status: 'terminated', deposit_settled_at: '2026-01-15' } as const;
    expect(pendingDepositSettlement([active, settled, unsettled])).toBeNull();
  });

  it('never asks for a refund on a contract that ended by renewal', () => {
    const renewed = { id: 'mid', status: 'expired', deposit_settled_at: null } as const;
    expect(pendingDepositSettlement([active, renewed])).toBeNull();
  });
});

describe('contractForBillingMonth', () => {
  const movedOut = {
    status: 'terminated' as const,
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    terminated_at: '2026-10-31',
  };

  it('bills the month a tenant moved out in, after the contract is terminated', () => {
    expect(contractForBillingMonth([movedOut], '2026-10-01')).toBe(movedOut);
  });

  it('does not bill months after the move-out, even though end_date is later', () => {
    expect(contractForBillingMonth([movedOut], '2026-11-01')).toBeNull();
  });

  it('does not bill months before the contract started', () => {
    const active = {
      status: 'active' as const,
      start_date: '2026-10-02',
      end_date: '2027-10-01',
      terminated_at: null,
    };
    expect(contractForBillingMonth([active], '2026-09-01')).toBeNull();
    expect(contractForBillingMonth([active], '2026-10-01')).toBe(active);
  });

  it('prefers the newer contract when a renewal shares a month', () => {
    const renewed = {
      status: 'active' as const,
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      terminated_at: null,
    };
    const expired = {
      status: 'expired' as const,
      start_date: '2025-09-01',
      end_date: '2026-09-01',
      terminated_at: null,
    };
    expect(contractForBillingMonth([renewed, expired], '2026-09-01')).toBe(renewed);
    expect(contractForBillingMonth([renewed, expired], '2026-08-01')).toBe(expired);
  });

  it('never bills a draft', () => {
    const draft = {
      status: 'draft' as const,
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      terminated_at: null,
    };
    expect(contractForBillingMonth([draft], '2026-09-01')).toBeNull();
  });
});
