import type { MaintenanceCategory } from '@/types/database';

/**
 * The fixed repair categories, so tickets group reliably. Mirrors
 * maintenance_category_ck (migration 0047); labels live in
 * messages under `maintenanceCategory`.
 */
export const MAINTENANCE_CATEGORIES = [
  'air_conditioning',
  'electrical',
  'plumbing',
  'appliance',
  'furniture',
  'door_lock',
  'building',
  'other',
] as const satisfies readonly MaintenanceCategory[];
