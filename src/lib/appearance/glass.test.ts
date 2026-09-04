import { describe, expect, it } from 'vitest';

import { glassOpacity } from './glass';

describe('glassOpacity', () => {
  it('converts transparency into surface opacity', () => {
    expect(glassOpacity(0)).toBe('100%');
    expect(glassOpacity(28)).toBe('72%');
    expect(glassOpacity(40)).toBe('60%');
  });
});
