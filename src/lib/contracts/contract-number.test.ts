import { describe, expect, it } from 'vitest';

import { contractNumber } from './contract-number';

describe('contractNumber', () => {
  it('combines the creation year-month with the id prefix', () => {
    expect(
      contractNumber({
        id: 'abcdef12-3456-7890-abcd-ef1234567890',
        created_at: '2026-01-15T10:00:00Z',
      }),
    ).toBe('202601-ABCDEF12');
  });
});
