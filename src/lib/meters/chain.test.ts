import { describe, expect, it } from 'vitest';

import { meterChainError } from './chain';

describe('meterChainError', () => {
  const september = { previous_reading: 1000, current_reading: 1120 };
  const november = { previous_reading: 1250, current_reading: 1400 };

  it('accepts a reading that continues from the earlier month and stops at the later one', () => {
    expect(
      meterChainError({ previous_reading: 1120, current_reading: 1250 }, september, november),
    ).toBeNull();
  });

  it('accepts a reading with no neighbours', () => {
    expect(meterChainError({ previous_reading: 0, current_reading: 50 }, null, null)).toBeNull();
  });

  it('rejects a reading that starts below the earlier month', () => {
    expect(
      meterChainError({ previous_reading: 1100, current_reading: 1250 }, september, null),
    ).toBe('validation.meter.overlapsEarlier');
  });

  it('rejects an edit that runs past the later month', () => {
    expect(
      meterChainError({ previous_reading: 1000, current_reading: 1300 }, null, {
        previous_reading: 1120,
        current_reading: 1250,
      }),
    ).toBe('validation.meter.overlapsLater');
  });

  it('leaves a gap alone -- units are unbilled, not billed twice', () => {
    expect(
      meterChainError({ previous_reading: 1130, current_reading: 1200 }, september, null),
    ).toBeNull();
  });
});
