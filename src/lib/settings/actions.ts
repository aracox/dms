'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import {
  ownerIdentitySchema,
  paymentBankSchema,
  propertyAddressSchema,
  propertyNameSchema,
  settingsSchema,
} from '@/lib/validation/schemas';
import type { PropertySegment } from '@/types/database';

import { SEGMENT_SETTING_KEYS, segmentFieldName, type SegmentSettingValues } from './segment-keys';

export interface SettingsState {
  message: string | null;
  error: string | null;
}

async function requireOwner() {
  const profile = await getCurrentProfile();
  // Throws PermissionError, which the error boundary renders.
  assertCan(profile?.role, 'settings:write');
  return profile!;
}

/**
 * Updates every editable setting, for both segments, in one upsert.
 *
 * Since migration 0025 these values live in `segment_settings`, one row per
 * (key, segment), and `settings.value` is frozen for them -- writing there
 * would now raise. Each row that actually changes is logged to
 * segment_settings_history by a DB trigger.
 *
 * Rates and fees already in use (meter readings, invoice items) keep the value
 * they were billed at, so this never rewrites a past month.
 */
export async function updateSettingsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  // Each segment's set is validated on its own, so "electricity rate must be
  // positive" is reported per segment rather than for the pair.
  const bySegment = {} as Record<PropertySegment, SegmentSettingValues>;

  for (const segment of PROPERTY_SEGMENTS) {
    const parsed = settingsSchema.safeParse(
      Object.fromEntries(
        SEGMENT_SETTING_KEYS.map((key) => [
          key,
          Number(formData.get(segmentFieldName(segment, key))),
        ]),
      ),
    );

    if (!parsed.success) {
      return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
    }

    bySegment[segment] = parsed.data;
  }

  const supabase = await createClient();
  const rows = PROPERTY_SEGMENTS.flatMap((segment) =>
    SEGMENT_SETTING_KEYS.map((key) => ({
      key,
      segment,
      value: bySegment[segment][key],
      updated_by: profile.id,
    })),
  );

  const { error } = await supabase
    .from('segment_settings')
    .upsert(rows, { onConflict: 'key,segment' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}

/**
 * Updates the property name shown on that segment's contract/receipt PDFs
 * (migration 0030). A single key, `property_name`, with a segment_settings
 * row per segment -- unlike the numeric settings above, its value is a
 * {name_th, name_en} object, so it gets its own schema and action rather than
 * folding into SEGMENT_SETTING_KEYS.
 */
export async function updatePropertyNamesAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  const bySegment = {} as Record<PropertySegment, { name_th: string; name_en: string }>;

  for (const segment of PROPERTY_SEGMENTS) {
    const parsed = propertyNameSchema.safeParse({
      name_th: String(formData.get(`${segment}.name_th`) ?? ''),
      name_en: String(formData.get(`${segment}.name_en`) ?? '').trim() || null,
    });

    if (!parsed.success) {
      return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
    }

    bySegment[segment] = { name_th: parsed.data.name_th, name_en: parsed.data.name_en ?? '' };
  }

  const supabase = await createClient();
  const rows = PROPERTY_SEGMENTS.map((segment) => ({
    key: 'property_name',
    segment,
    value: bySegment[segment],
    updated_by: profile.id,
  }));

  const { error } = await supabase
    .from('segment_settings')
    .upsert(rows, { onConflict: 'key,segment' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}

/**
 * Updates the owner identity (name, ID card, address, phone) shown as the
 * lessor party on that segment's contract PDF (migration 0034, extended by
 * 0035). Same key (`owner_name`) and pattern as updatePropertyNamesAction,
 * with the wider shape validated by ownerIdentitySchema.
 */
export async function updateOwnerNamesAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  type OwnerIdentityValue = {
    name_th: string;
    name_en: string;
    id_card: string;
    address: string;
    phone: string;
  };
  const bySegment = {} as Record<PropertySegment, OwnerIdentityValue>;

  for (const segment of PROPERTY_SEGMENTS) {
    const parsed = ownerIdentitySchema.safeParse({
      name_th: String(formData.get(`${segment}.name_th`) ?? ''),
      name_en: String(formData.get(`${segment}.name_en`) ?? '').trim() || null,
      id_card: String(formData.get(`${segment}.id_card`) ?? '').trim() || null,
      address: String(formData.get(`${segment}.address`) ?? '').trim() || null,
      phone: String(formData.get(`${segment}.phone`) ?? '').trim(),
    });

    if (!parsed.success) {
      return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
    }

    bySegment[segment] = {
      name_th: parsed.data.name_th,
      name_en: parsed.data.name_en ?? '',
      id_card: parsed.data.id_card ?? '',
      address: parsed.data.address ?? '',
      phone: parsed.data.phone ?? '',
    };
  }

  const supabase = await createClient();
  const rows = PROPERTY_SEGMENTS.map((segment) => ({
    key: 'owner_name',
    segment,
    value: bySegment[segment],
    updated_by: profile.id,
  }));

  const { error } = await supabase
    .from('segment_settings')
    .upsert(rows, { onConflict: 'key,segment' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}

/**
 * Updates the bank account shown in the contract's payment clause (migration
 * 0035). Same pattern as updatePropertyNamesAction -- a {bank_name,
 * account_number, account_name} object per segment.
 */
export async function updatePaymentBankAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  type PaymentBankValue = { bank_name: string; account_number: string; account_name: string };
  const bySegment = {} as Record<PropertySegment, PaymentBankValue>;

  for (const segment of PROPERTY_SEGMENTS) {
    const parsed = paymentBankSchema.safeParse({
      bank_name: String(formData.get(`${segment}.bank_name`) ?? '').trim() || null,
      account_number: String(formData.get(`${segment}.account_number`) ?? '').trim() || null,
      account_name: String(formData.get(`${segment}.account_name`) ?? '').trim() || null,
    });

    if (!parsed.success) {
      return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
    }

    bySegment[segment] = {
      bank_name: parsed.data.bank_name ?? '',
      account_number: parsed.data.account_number ?? '',
      account_name: parsed.data.account_name ?? '',
    };
  }

  const supabase = await createClient();
  const rows = PROPERTY_SEGMENTS.map((segment) => ({
    key: 'payment_bank',
    segment,
    value: bySegment[segment],
    updated_by: profile.id,
  }));

  const { error } = await supabase
    .from('segment_settings')
    .upsert(rows, { onConflict: 'key,segment' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}

/**
 * Updates the property address shown alongside the property name in the
 * contract's "ทรัพย์สินที่เช่า" section (migration 0035). Stored as a plain
 * jsonb string per segment, unlike the object-shaped keys above.
 */
export async function updatePropertyAddressAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const profile = await requireOwner();

  const bySegment = {} as Record<PropertySegment, string>;

  for (const segment of PROPERTY_SEGMENTS) {
    const parsed = propertyAddressSchema.safeParse({
      address: String(formData.get(`${segment}.address`) ?? '').trim() || null,
    });

    if (!parsed.success) {
      return { message: null, error: parsed.error.issues[0]?.message ?? 'errors.generic' };
    }

    bySegment[segment] = parsed.data.address ?? '';
  }

  const supabase = await createClient();
  const rows = PROPERTY_SEGMENTS.map((segment) => ({
    key: 'property_address',
    segment,
    value: bySegment[segment],
    updated_by: profile.id,
  }));

  const { error } = await supabase
    .from('segment_settings')
    .upsert(rows, { onConflict: 'key,segment' });
  if (error) return { message: null, error: 'errors.generic' };

  revalidatePath('/settings');
  return { message: 'settings.saved', error: null };
}
