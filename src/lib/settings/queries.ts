import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { createClient } from '@/lib/supabase/server';
import type { PropertySegment } from '@/types/database';

import {
  SEGMENT_SETTING_KEYS,
  type SegmentSettingKey,
  type SegmentSettingValues,
  type SettingsBySegment,
} from './segment-keys';

export interface PropertyIdentity {
  name_th: string;
  name_en: string;
}

const FALLBACK: PropertyIdentity = { name_th: '', name_en: '' };

/**
 * Both segments' rates, fees and defaults.
 *
 * Reads segment_settings, which migration 0025 made authoritative for these
 * keys -- `settings.value` is frozen for them, so reading it would give a stale
 * price. Every key is guaranteed present for both segments by the schema, but a
 * missing row degrades to 0 here rather than throwing: the settings page must
 * still render so the owner can see and fix it.
 */
export async function getSettingsBySegment(): Promise<SettingsBySegment> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('segment_settings').select('key, segment, value');

  if (error) {
    throw new Error(`segment_settings read failed -- ${error.message}`, { cause: error });
  }

  const read = (segment: PropertySegment, key: SegmentSettingKey) => {
    const found = data?.find((row) => row.segment === segment && row.key === key)?.value;
    return typeof found === 'number' ? found : Number(found ?? 0) || 0;
  };

  return Object.fromEntries(
    PROPERTY_SEGMENTS.map((segment) => [
      segment,
      Object.fromEntries(
        SEGMENT_SETTING_KEYS.map((key) => [key, read(segment, key)]),
      ) as SegmentSettingValues,
    ]),
  ) as SettingsBySegment;
}

/**
 * One segment's rates and fees, for a page that already knows which segment it
 * is dealing with -- a room's meter form, a move-in, an invoice.
 */
export async function getSegmentSettings(segment: PropertySegment): Promise<SegmentSettingValues> {
  return (await getSettingsBySegment())[segment];
}

/**
 * Both segments' property name (migration 0030), shown on that segment's
 * contract and receipt PDFs instead of the one whole-property `dormitory`
 * name. Segment-scoped like the rates above, so both rows are guaranteed
 * present by the same settings_seed_segments trigger.
 */
export async function getPropertyNamesBySegment(): Promise<
  Record<PropertySegment, PropertyIdentity>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('segment_settings')
    .select('segment, value')
    .eq('key', 'property_name');

  const read = (segment: PropertySegment): PropertyIdentity => {
    const value = (data?.find((row) => row.segment === segment)?.value ??
      {}) as Partial<PropertyIdentity>;
    return {
      name_th: value.name_th ?? FALLBACK.name_th,
      name_en: value.name_en ?? FALLBACK.name_en,
    };
  };

  return Object.fromEntries(PROPERTY_SEGMENTS.map((segment) => [segment, read(segment)])) as Record<
    PropertySegment,
    PropertyIdentity
  >;
}

/** One segment's property name, for a document that already knows its segment. */
export async function getPropertyName(segment: PropertySegment): Promise<PropertyIdentity> {
  return (await getPropertyNamesBySegment())[segment];
}
