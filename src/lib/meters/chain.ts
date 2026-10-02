import type { MeterReadingRow } from '@/types/database';

type Reading = Pick<MeterReadingRow, 'previous_reading' | 'current_reading'>;

/**
 * Whether a reading would overlap the same meter's neighbouring months. Each
 * month starts where the one before it ended, so a reading that reaches back
 * below the earlier month's end, or past the later month's start, bills the
 * shared units twice. Returns the validation key to show, or null if it fits.
 */
export function meterChainError(
  reading: Reading,
  earlier: Reading | null,
  later: Reading | null,
): string | null {
  if (earlier && reading.previous_reading < earlier.current_reading) {
    return 'validation.meter.overlapsEarlier';
  }
  if (later && reading.current_reading > later.previous_reading) {
    return 'validation.meter.overlapsLater';
  }
  return null;
}
