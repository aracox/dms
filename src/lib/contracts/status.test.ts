import { describe, expect, it } from 'vitest';

import { contractDisplayStatus, pendingDepositSettlement } from './status';

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
