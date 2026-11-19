import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

import { BACKGROUND_IMAGE_INIT_SCRIPT, glassOpacity } from './glass';

describe('glassOpacity', () => {
  it('converts transparency into surface opacity', () => {
    expect(glassOpacity(0)).toBe('100%');
    expect(glassOpacity(28)).toBe('72%');
    expect(glassOpacity(40)).toBe('60%');
  });
});

describe('background image preference on page load', () => {
  it.each([null, 'false'])('uses a plain background with preference %s', (preference) => {
    const dataset: Record<string, string> = {};
    runInNewContext(BACKGROUND_IMAGE_INIT_SCRIPT, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: () => preference },
    });
    expect(dataset.backgroundImage).toBe('hidden');
  });

  it('restores an explicitly enabled background image', () => {
    const dataset: Record<string, string> = {};
    runInNewContext(BACKGROUND_IMAGE_INIT_SCRIPT, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: () => 'true' },
    });
    expect(dataset.backgroundImage).toBe('visible');
  });

  it('does not interrupt page loading when browser storage is blocked', () => {
    expect(() =>
      runInNewContext(BACKGROUND_IMAGE_INIT_SCRIPT, {
        document: { documentElement: { dataset: {} } },
        localStorage: {
          getItem: () => {
            throw new Error('Storage blocked');
          },
        },
      }),
    ).not.toThrow();
  });
});
