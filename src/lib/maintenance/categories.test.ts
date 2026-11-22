/**
 * The repair categories live in three places: this list, the CHECK constraint
 * in migration 0047, and the labels in both message files. A key missing from
 * any one either can't be saved or shows its raw key.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MAINTENANCE_CATEGORIES } from './categories';

const readRepoFile = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('MAINTENANCE_CATEGORIES', () => {
  it('matches the database CHECK constraint exactly', () => {
    const migration = readRepoFile('../../../supabase/migrations/0047_maintenance_categories.sql');
    const check = migration.match(/maintenance_category_ck check \(category in \(([^)]*)\)/);
    const keys = [...(check?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(keys.sort()).toEqual([...MAINTENANCE_CATEGORIES].sort());
  });

  it.each(['th', 'en'])('has a %s label for every category', (locale) => {
    const messages = JSON.parse(readRepoFile(`../../messages/${locale}.json`));
    expect(Object.keys(messages.maintenanceCategory).sort()).toEqual(
      [...MAINTENANCE_CATEGORIES].sort(),
    );
  });
});
