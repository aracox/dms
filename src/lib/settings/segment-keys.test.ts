/**
 * The segment-scoped setting list has to agree with three other places: the zod
 * schema that validates a submission, the form that renders the fields, and
 * `settings.is_segment_scoped` in migration 0025. Drift between them is silent
 * and expensive -- a key missing from this list simply stops being saved.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { settingsSchema } from '@/lib/validation/schemas';

import { SEGMENT_SETTING_KEYS, segmentFieldName } from './segment-keys';

const readRepoFile = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('SEGMENT_SETTING_KEYS', () => {
  it('matches the validation schema exactly, so nothing is validated but unsaved', () => {
    const schemaKeys = Object.keys(settingsSchema.shape).sort();
    expect([...SEGMENT_SETTING_KEYS].sort()).toEqual(schemaKeys);
  });

  it('excludes the two whole-property settings', () => {
    // Splitting either of these would be meaningless: one property, one name.
    expect(SEGMENT_SETTING_KEYS).not.toContain('currency');
    expect(SEGMENT_SETTING_KEYS).not.toContain('dormitory');
  });

  it('lists no key twice', () => {
    expect(new Set(SEGMENT_SETTING_KEYS).size).toBe(SEGMENT_SETTING_KEYS.length);
  });

  it('has a field rendered in the settings form for every key', () => {
    const form = readRepoFile('../../components/settings/SettingsForm.tsx');
    for (const key of SEGMENT_SETTING_KEYS) {
      expect(form, `SettingsForm.tsx renders no field for ${key}`).toContain(`'${key}'`);
    }
  });
});

describe('segmentFieldName', () => {
  it('namespaces by segment so both sets post from one form', () => {
    expect(segmentFieldName('dorm', 'water_rate')).toBe('dorm.water_rate');
    expect(segmentFieldName('house', 'water_rate')).toBe('house.water_rate');
  });

  it('never collides between the segments', () => {
    const names = SEGMENT_SETTING_KEYS.flatMap((key) => [
      segmentFieldName('dorm', key),
      segmentFieldName('house', key),
    ]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('migration 0025 agrees with this list', () => {
  const migration = readRepoFile('../../../supabase/migrations/0025_segment_settings.sql');

  it('marks only currency and dormitory as whole-property', () => {
    expect(migration).toContain(
      "update settings set is_segment_scoped = false where key in ('currency', 'dormitory')",
    );
  });

  it('freezes settings.value for segment-scoped keys, so there is one source of truth', () => {
    expect(migration).toContain('settings_reject_scoped_value_write');
    expect(migration).toMatch(/update segment_settings instead/);
  });

  it('grants no delete on segment_settings, keeping both segments present', () => {
    expect(migration).toContain('grant select, insert, update on segment_settings');
    expect(migration).not.toMatch(/create policy \w+ on segment_settings for delete/);
  });

  it('raises rather than defaulting when a segment value is missing', () => {
    // There is no shared fallback by design, so billing 0 THB silently would be
    // far worse than failing loudly.
    expect(migration).toContain('segment_settings has no value for');
    expect(migration).toContain('no_data_found');
  });

  it('repoints every settings-reading SQL function at the segment form', () => {
    for (const fn of ['payment_grace_days', 'default_monthly_rent', 'default_deposit']) {
      expect(migration, `${fn} has no segment overload`).toContain(
        `create or replace function ${fn}(p_segment property_segment)`,
      );
      // The no-argument form must not silently keep reading frozen settings.
      expect(migration, `${fn}() is not stubbed out`).toContain(
        `'${fn}() is per segment since 0025`,
      );
    }
  });

  it('replaces every caller of those functions', () => {
    for (const caller of [
      'create or replace view v_room_board',
      'create or replace function recalc_invoice',
      'create or replace function mark_overdue_invoices',
      'create or replace view report_finance_summary with',
      'create or replace view report_finance_summary_by_segment',
    ]) {
      expect(migration, `${caller} is not updated`).toContain(caller);
    }
  });

  it('leaves no no-argument call of the three functions behind', () => {
    for (const fn of ['payment_grace_days', 'default_monthly_rent', 'default_deposit']) {
      // Only the raising stub declares the empty signature; nothing may call it.
      const calls = migration.match(new RegExp(`${fn}\\(\\)`, 'g')) ?? [];
      const declarations =
        migration.match(new RegExp(`create or replace function ${fn}\\(\\)`, 'g')) ?? [];
      const inMessages = migration.match(new RegExp(`'${fn}\\(\\) is per segment`, 'g')) ?? [];
      expect(
        calls.length - declarations.length - inMessages.length,
        `${fn}() is still called somewhere`,
      ).toBe(0);
    }
  });
});
