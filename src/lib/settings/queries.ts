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

/** Owner identity (migration 0035): name plus the ID/contact details a lease needs. */
export interface OwnerIdentity extends PropertyIdentity {
  id_card: string;
  address: string;
  phone: string;
}

/** Bank account a segment's rent is paid into, shown in the contract's payment clause. */
export interface PaymentBank {
  bank_name: string;
  account_number: string;
  account_name: string;
}

const FALLBACK: PropertyIdentity = { name_th: '', name_en: '' };
const OWNER_FALLBACK: OwnerIdentity = { ...FALLBACK, id_card: '', address: '', phone: '' };
const PAYMENT_BANK_FALLBACK: PaymentBank = { bank_name: '', account_number: '', account_name: '' };

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

/**
 * Both segments' owner identity (migration 0034, extended by 0035), the
 * lessor party shown on that segment's contract PDF -- a person's name, ID
 * card, address and phone, distinct from property_name (the place).
 * Segment-scoped like property_name, so both rows are guaranteed present by
 * the same settings_seed_segments trigger.
 */
export async function getOwnerNamesBySegment(): Promise<Record<PropertySegment, OwnerIdentity>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('segment_settings')
    .select('segment, value')
    .eq('key', 'owner_name');

  const read = (segment: PropertySegment): OwnerIdentity => {
    const value = (data?.find((row) => row.segment === segment)?.value ??
      {}) as Partial<OwnerIdentity>;
    return {
      name_th: value.name_th ?? OWNER_FALLBACK.name_th,
      name_en: value.name_en ?? OWNER_FALLBACK.name_en,
      id_card: value.id_card ?? OWNER_FALLBACK.id_card,
      address: value.address ?? OWNER_FALLBACK.address,
      phone: value.phone ?? OWNER_FALLBACK.phone,
    };
  };

  return Object.fromEntries(PROPERTY_SEGMENTS.map((segment) => [segment, read(segment)])) as Record<
    PropertySegment,
    OwnerIdentity
  >;
}

/** One segment's owner identity, for a document that already knows its segment. */
export async function getOwnerName(segment: PropertySegment): Promise<OwnerIdentity> {
  return (await getOwnerNamesBySegment())[segment];
}

/**
 * Both segments' bank account (migration 0035), shown in the contract's
 * payment clause. Segment-scoped: dorm and house may settle into different
 * accounts.
 */
export async function getPaymentBanksBySegment(): Promise<Record<PropertySegment, PaymentBank>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('segment_settings')
    .select('segment, value')
    .eq('key', 'payment_bank');

  const read = (segment: PropertySegment): PaymentBank => {
    const value = (data?.find((row) => row.segment === segment)?.value ??
      {}) as Partial<PaymentBank>;
    return {
      bank_name: value.bank_name ?? PAYMENT_BANK_FALLBACK.bank_name,
      account_number: value.account_number ?? PAYMENT_BANK_FALLBACK.account_number,
      account_name: value.account_name ?? PAYMENT_BANK_FALLBACK.account_name,
    };
  };

  return Object.fromEntries(PROPERTY_SEGMENTS.map((segment) => [segment, read(segment)])) as Record<
    PropertySegment,
    PaymentBank
  >;
}

/** One segment's bank account, for a document that already knows its segment. */
export async function getPaymentBank(segment: PropertySegment): Promise<PaymentBank> {
  return (await getPaymentBanksBySegment())[segment];
}

/**
 * Both segments' property address (migration 0035), shown alongside
 * property_name in the contract's "ทรัพย์สินที่เช่า" section. Segment-scoped
 * like property_name; stored as a plain jsonb string rather than an object
 * since there is only one field.
 */
export async function getPropertyAddressesBySegment(): Promise<Record<PropertySegment, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('segment_settings')
    .select('segment, value')
    .eq('key', 'property_address');

  const read = (segment: PropertySegment): string => {
    const value = data?.find((row) => row.segment === segment)?.value;
    return typeof value === 'string' ? value : '';
  };

  return Object.fromEntries(PROPERTY_SEGMENTS.map((segment) => [segment, read(segment)])) as Record<
    PropertySegment,
    string
  >;
}

/** One segment's property address, for a document that already knows its segment. */
export async function getPropertyAddress(segment: PropertySegment): Promise<string> {
  return (await getPropertyAddressesBySegment())[segment];
}
