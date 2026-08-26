import type { AppRole } from '@/types/database';

/**
 * Role-based permissions.
 *
 * This mirrors the RLS policies in migration 0007. RLS is the enforcement;
 * this table exists so the UI can hide actions the user cannot perform, and so
 * Server Actions can fail fast with a clear message instead of a database error.
 *
 * Never rely on this alone -- always let RLS have the final say.
 */

export const ROLE_RANK: Record<AppRole, number> = {
  staff: 1,
  admin: 2,
  owner: 3,
};

export type Permission =
  | 'rooms:read'
  | 'rooms:write'
  | 'rooms:delete'
  | 'tenants:read'
  | 'tenants:write'
  | 'contracts:read'
  | 'contracts:write'
  | 'cards:read'
  | 'cards:write'
  | 'meters:read'
  | 'meters:record'
  | 'meters:correct'
  | 'invoices:read'
  | 'invoices:write'
  | 'payments:read'
  | 'payments:record'
  | 'payments:delete'
  | 'maintenance:read'
  | 'maintenance:write'
  | 'reports:read'
  | 'settings:read'
  | 'settings:write'
  | 'audit:read'
  | 'test-mode:use';

/** Minimum role required for each permission. */
const REQUIRED_ROLE: Record<Permission, AppRole> = {
  'rooms:read': 'staff',
  'rooms:write': 'admin',
  'rooms:delete': 'owner',

  'tenants:read': 'staff',
  'tenants:write': 'admin',

  'contracts:read': 'staff',
  'contracts:write': 'admin',

  'cards:read': 'staff',
  'cards:write': 'admin',

  'meters:read': 'staff',
  'meters:record': 'staff',
  'meters:correct': 'admin',

  'invoices:read': 'staff',
  'invoices:write': 'admin',

  'payments:read': 'staff',
  'payments:record': 'staff',
  // Deleting a payment destroys financial evidence.
  'payments:delete': 'owner',

  'maintenance:read': 'staff',
  'maintenance:write': 'staff',

  'reports:read': 'staff',

  'settings:read': 'staff',
  'settings:write': 'owner',

  'audit:read': 'admin',

  'test-mode:use': 'admin',
};

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[REQUIRED_ROLE[permission]];
}

export function requiredRoleFor(permission: Permission): AppRole {
  return REQUIRED_ROLE[permission];
}

export class PermissionError extends Error {
  constructor(readonly permission: Permission) {
    super(`Requires ${REQUIRED_ROLE[permission]} role: ${permission}`);
    this.name = 'PermissionError';
  }
}

/** Throws unless the role holds the permission. Use at the top of a Server Action. */
export function assertCan(role: AppRole | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new PermissionError(permission);
}
