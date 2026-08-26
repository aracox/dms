import { describe, expect, it } from 'vitest';

import { assertCan, can, PermissionError } from './index';

describe('permissions', () => {
  it('gives the owner everything', () => {
    expect(can('owner', 'payments:delete')).toBe(true);
    expect(can('owner', 'settings:write')).toBe(true);
    expect(can('owner', 'rooms:delete')).toBe(true);
  });

  it('gives admin operational access but not destructive access', () => {
    expect(can('admin', 'contracts:write')).toBe(true);
    expect(can('admin', 'invoices:write')).toBe(true);
    expect(can('admin', 'payments:delete')).toBe(false);
    expect(can('admin', 'settings:write')).toBe(false);
    expect(can('admin', 'rooms:delete')).toBe(false);
  });

  it('limits staff to recording day-to-day work', () => {
    expect(can('staff', 'meters:record')).toBe(true);
    expect(can('staff', 'payments:record')).toBe(true);
    expect(can('staff', 'maintenance:write')).toBe(true);

    expect(can('staff', 'meters:correct')).toBe(false);
    expect(can('staff', 'contracts:write')).toBe(false);
    expect(can('staff', 'cards:write')).toBe(false);
    expect(can('staff', 'settings:write')).toBe(false);
    expect(can('staff', 'audit:read')).toBe(false);
  });

  it('denies everything to a user with no profile', () => {
    expect(can(null, 'rooms:read')).toBe(false);
    expect(can(undefined, 'reports:read')).toBe(false);
  });

  it('throws PermissionError from assertCan', () => {
    expect(() => assertCan('staff', 'payments:delete')).toThrow(PermissionError);
    expect(() => assertCan('owner', 'payments:delete')).not.toThrow();
  });
});
