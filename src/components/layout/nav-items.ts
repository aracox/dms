import type { Permission } from '@/lib/permissions';

export interface NavItem {
  /** Route relative to the [locale] segment. */
  href: string;
  /** Translation key under `nav`. */
  labelKey: string;
  /** Lucide icon name, resolved in Sidebar. */
  icon: string;
  /** Omit for a personal item every signed-in user can see, regardless of role. */
  permission?: Permission;
}

export interface NavSection {
  /** Translation key under `nav`, or null for the ungrouped top items. */
  labelKey: string | null;
  items: NavItem[];
}

/**
 * Main navigation, per the spec's §26 ordering.
 *
 * Tenants and Contracts are deliberately absent: they are reached through Room
 * Detail, which is where the owner actually thinks about them.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: null,
    items: [
      {
        href: '/dashboard',
        labelKey: 'dashboard',
        icon: 'LayoutDashboard',
        permission: 'reports:read',
      },
      { href: '/floor-plan', labelKey: 'floorPlan', icon: 'Map', permission: 'rooms:read' },
      { href: '/rooms', labelKey: 'rooms', icon: 'DoorClosed', permission: 'rooms:read' },
    ],
  },
  {
    labelKey: 'finance',
    items: [
      { href: '/billing', labelKey: 'billing', icon: 'ReceiptText', permission: 'invoices:read' },
      { href: '/payments', labelKey: 'payments', icon: 'Banknote', permission: 'payments:read' },
      { href: '/meters', labelKey: 'meters', icon: 'Gauge', permission: 'meters:read' },
    ],
  },
  {
    labelKey: 'operations',
    items: [
      {
        href: '/access-cards',
        labelKey: 'accessCards',
        icon: 'CreditCard',
        permission: 'cards:read',
      },
      {
        href: '/maintenance',
        labelKey: 'maintenance',
        icon: 'Wrench',
        permission: 'maintenance:read',
      },
      { href: '/reports', labelKey: 'reports', icon: 'ChartColumn', permission: 'reports:read' },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { href: '/profile', labelKey: 'profile', icon: 'User' },
      { href: '/settings', labelKey: 'settings', icon: 'Settings', permission: 'settings:read' },
      { href: '/test', labelKey: 'testMode', icon: 'FlaskConical', permission: 'test-mode:use' },
    ],
  },
];
