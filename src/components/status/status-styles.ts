import type { FinancialStatus, RoomStatus } from '@/types/database';

/**
 * The single mapping from room state to its visual treatment.
 *
 * Accessibility rule from the spec: never rely on colour alone. Every entry
 * therefore carries an `icon` and a `labelKey` alongside its colour classes,
 * and the floor plan additionally hatches the maintenance fill.
 */

export type RoomDisplayStatus =
  | 'vacant'
  | 'reserved'
  | 'maintenance'
  | 'occupied_no_bill'
  | 'occupied_paid'
  | 'occupied_due'
  | 'occupied_overdue';

/** Lucide icon names, resolved by the components that render them. */
export type StatusIconName =
  'DoorOpen' | 'CalendarClock' | 'Wrench' | 'User' | 'CircleCheck' | 'Clock' | 'TriangleAlert';

export interface StatusStyle {
  /** Translation key under `combinedStatus`. */
  labelKey: string;
  icon: StatusIconName;
  /** Badge classes (tint background, dark text, coloured border). */
  badge: string;
  /** Floor-plan fill. */
  fill: string;
  /** Floor-plan stroke. */
  stroke: string;
  /** Floor-plan label colour. */
  text: string;
  /** Legend swatch. */
  swatch: string;
  /** Maintenance is additionally hatched so it reads without colour. */
  hatched?: boolean;
}

export const STATUS_STYLES: Record<RoomDisplayStatus, StatusStyle> = {
  vacant: {
    labelKey: 'vacant',
    icon: 'DoorOpen',
    badge: 'bg-status-vacant text-status-vacant-ink border-status-vacant-edge',
    fill: 'fill-status-vacant',
    stroke: 'stroke-status-vacant-edge',
    text: 'fill-status-vacant-ink',
    swatch: 'bg-status-vacant border-status-vacant-edge',
  },
  reserved: {
    labelKey: 'reserved',
    icon: 'CalendarClock',
    badge: 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue',
    fill: 'fill-brand-blue-soft',
    stroke: 'stroke-brand-blue',
    text: 'fill-brand-blue-deep',
    swatch: 'bg-brand-blue-soft border-brand-blue',
  },
  maintenance: {
    labelKey: 'maintenance',
    icon: 'Wrench',
    badge: 'bg-status-maintenance text-status-maintenance-ink border-status-maintenance-edge',
    fill: 'fill-status-maintenance',
    stroke: 'stroke-status-maintenance-edge',
    text: 'fill-status-maintenance-ink',
    swatch: 'bg-status-maintenance border-status-maintenance-edge',
    hatched: true,
  },
  occupied_no_bill: {
    labelKey: 'occupiedNoBill',
    icon: 'User',
    badge: 'bg-status-occupied text-status-occupied-ink border-status-occupied-edge',
    fill: 'fill-status-occupied',
    stroke: 'stroke-status-occupied-edge',
    text: 'fill-status-occupied-ink',
    swatch: 'bg-status-occupied border-status-occupied-edge',
  },
  occupied_paid: {
    labelKey: 'occupiedPaid',
    icon: 'CircleCheck',
    badge: 'bg-status-paid text-status-paid-ink border-status-paid-edge',
    fill: 'fill-status-paid',
    stroke: 'stroke-status-paid-edge',
    text: 'fill-status-paid-ink',
    swatch: 'bg-status-paid border-status-paid-edge',
  },
  occupied_due: {
    labelKey: 'occupiedDue',
    icon: 'Clock',
    badge: 'bg-status-due text-status-due-ink border-status-due-edge',
    fill: 'fill-status-due',
    stroke: 'stroke-status-due-edge',
    text: 'fill-status-due-ink',
    swatch: 'bg-status-due border-status-due-edge',
  },
  occupied_overdue: {
    labelKey: 'occupiedOverdue',
    icon: 'TriangleAlert',
    badge: 'bg-status-overdue text-status-overdue-ink border-status-overdue-edge',
    fill: 'fill-status-overdue',
    stroke: 'stroke-status-overdue-edge',
    text: 'fill-status-overdue-ink',
    swatch: 'bg-status-overdue border-status-overdue-edge',
  },
};

/**
 * Collapse room status and financial status into one display status.
 *
 * Room status wins for anything that is not `occupied`: a room withdrawn for
 * maintenance reads as maintenance even if an old invoice is outstanding.
 */
export function toDisplayStatus(
  roomStatus: RoomStatus,
  financialStatus: FinancialStatus,
): RoomDisplayStatus {
  if (roomStatus === 'vacant') return 'vacant';
  if (roomStatus === 'reserved') return 'reserved';
  if (roomStatus === 'maintenance') return 'maintenance';

  switch (financialStatus) {
    case 'paid':
      return 'occupied_paid';
    case 'payment_due':
      return 'occupied_due';
    case 'overdue':
      return 'occupied_overdue';
    case 'none':
      return 'occupied_no_bill';
  }
}

/** Legend order, worst-first so the owner's eye lands on problems. */
export const LEGEND_ORDER: RoomDisplayStatus[] = [
  'occupied_overdue',
  'occupied_due',
  'occupied_paid',
  'occupied_no_bill',
  'reserved',
  'maintenance',
  'vacant',
];
