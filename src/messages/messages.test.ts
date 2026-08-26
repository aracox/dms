import { describe, expect, it } from 'vitest';

import en from './en.json';
import th from './th.json';

/** Every leaf key path, e.g. 'room.tabs.overview'. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation catalogues', () => {
  const thKeys = keyPaths(th).sort();
  const enKeys = keyPaths(en).sort();

  it('define the same keys in Thai and English', () => {
    expect(thKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !thKeys.includes(key))).toEqual([]);
  });

  it('have no empty strings', () => {
    for (const [locale, messages] of [
      ['th', th],
      ['en', en],
    ] as const) {
      const flat = JSON.stringify(messages);
      expect(flat, `${locale} has an empty message`).not.toMatch(/:\s*""/);
    }
  });

  it('keep database enum values as translation keys, not as displayed text', () => {
    // Status values stay language-neutral in the database; only the UI translates
    // them. These keys must therefore exist verbatim for every enum member.
    for (const status of ['vacant', 'occupied', 'reserved', 'maintenance']) {
      expect(thKeys).toContain(`roomStatus.${status}`);
      expect(enKeys).toContain(`roomStatus.${status}`);
    }
    for (const status of ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled']) {
      expect(thKeys).toContain(`invoiceStatus.${status}`);
    }
    for (const status of ['available', 'active', 'lost', 'disabled', 'damaged', 'returned']) {
      expect(thKeys).toContain(`cardStatus.${status}`);
    }
  });

  it('cover every validation message key used by the Zod schemas', () => {
    for (const key of [
      'validation.required',
      'validation.date.format',
      'validation.date.firstOfMonth',
      'validation.money.negative',
      'validation.money.notPositive',
      'validation.phone.format',
      'validation.email.format',
      'validation.room.floorRange',
      'validation.contract.dueDayRange',
      'validation.contract.occupantsMin',
      'validation.contract.endBeforeStart',
      'validation.card.slot',
      'validation.meter.reversed',
      'validation.invoice.noItems',
    ]) {
      expect(thKeys, `missing ${key} in th.json`).toContain(key);
      expect(enKeys, `missing ${key} in en.json`).toContain(key);
    }
  });
});
