import type { PropertySegment } from '@/types/database';

/**
 * The settings the owner sets separately for หอพัก and บ้านพัก.
 *
 * Mirrors `settings.is_segment_scoped` from migration 0025 -- change one,
 * change both. Only `currency` and `dormitory` describe the whole property and
 * stay in `settings`.
 *
 * `late_fee_per_day` is exposed here since migration 0035, printed on the
 * contract's payment clause. It is still not enforced by billing -- setting it
 * does not make recalc_invoice charge it.
 */
export const SEGMENT_SETTING_KEYS = [
  'electricity_rate',
  'water_rate',
  'default_monthly_rent',
  'default_deposit',
  'default_payment_due_day',
  'payment_grace_days',
  'internet_fee',
  'parking_fee_car',
  'parking_fee_motorcycle',
  'card_replacement_fee',
  'late_fee_per_day',
  'netflix_fee',
  'youtube_fee',
  'disney_fee',
  'viu_fee',
  'hbo_fee',
  'amazon_prime_fee',
] as const;

export type SegmentSettingKey = (typeof SEGMENT_SETTING_KEYS)[number];

/** One segment's full set. Every key is always present -- there is no fallback. */
export type SegmentSettingValues = Record<SegmentSettingKey, number>;

/** Both segments' sets, which is what the settings page reads and writes. */
export type SettingsBySegment = Record<PropertySegment, SegmentSettingValues>;

/**
 * The form field name for one segment's setting, e.g. `dorm.water_rate`.
 *
 * Namespacing by segment keeps a single form posting both sets without the two
 * halves colliding on `name`.
 */
export function segmentFieldName(segment: PropertySegment, key: SegmentSettingKey): string {
  return `${segment}.${key}`;
}
