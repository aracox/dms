import { describe, expect, it } from 'vitest';

import { contractDisplayStatus } from './status';

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
