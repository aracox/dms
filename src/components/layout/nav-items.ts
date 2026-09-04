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
 * Main navigation ordered around the owner's monthly and daily workflows.
 *
 * Tenants and Contracts are reached through Room Detail. Profile lives in the
 * account area in the header instead of being duplicated here.
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
    labelKey: 'monthlyWorkflow',
    items: [
      { href: '/meters', labelKey: 'meters', icon: 'Gauge', permission: 'meters:read' },
      { href: '/billing', labelKey: 'billing', icon: 'ReceiptText', permission: 'invoices:read' },
      { href: '/payments', labelKey: 'payments', icon: 'Banknote', permission: 'payments:read' },
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
    ],
  },
  {
    labelKey: 'financeInsights',
    items: [
      {
        href: '/expenses',
        labelKey: 'expenses',
        icon: 'HandCoins',
        permission: 'expenses:read',
      },
      { href: '/reports', labelKey: 'reports', icon: 'ChartColumn', permission: 'reports:read' },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { href: '/settings', labelKey: 'settings', icon: 'Settings', permission: 'settings:read' },
      { href: '/test', labelKey: 'testMode', icon: 'FlaskConical', permission: 'test-mode:use' },
    ],
  },
];
