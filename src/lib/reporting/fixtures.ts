/**
 * The seed dataset, in TypeScript.
 *
 * supabase/seed.sql is the source of truth. This mirrors it so the exclusion
 * rule can be tested without a live database. If the seed changes, the numbers
 * asserted in exclusion.test.ts change with it -- which is the point: the test
 * fails and forces the two back into agreement.
 *
 * Includes T01 deliberately. A fixture set without the test room could not
 * prove that the test room is excluded.
 */

import type { InvoiceStatus, RoomStatus } from '@/types/database';
import type { IsoDate } from '@/lib/utils/date';

export const SEED_TODAY: IsoDate = '2026-08-26';
export const SEED_BILLING_MONTH: IsoDate = '2026-08-01';

export interface SeedRoom {
  room_number: string;
  floor: number;
  is_test: boolean;
  room_status: RoomStatus;
  monthly_rent: number;
}

/** 24 real rooms (21 dorm rooms across floors 1-3 + 3 houses on floor 1), plus T01 on floor 0. */
export const seedRooms: SeedRoom[] = [
  { room_number: '101', floor: 1, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '102', floor: 1, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '103', floor: 1, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '104', floor: 1, is_test: false, room_status: 'occupied', monthly_rent: 4500 },
  { room_number: '105', floor: 1, is_test: false, room_status: 'maintenance', monthly_rent: 4500 },
  { room_number: '106', floor: 1, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '107', floor: 1, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '201', floor: 2, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '202', floor: 2, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '203', floor: 2, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '204', floor: 2, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '205', floor: 2, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '206', floor: 2, is_test: false, room_status: 'reserved', monthly_rent: 4500 },
  { room_number: '207', floor: 2, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '301', floor: 3, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '302', floor: 3, is_test: false, room_status: 'occupied', monthly_rent: 6000 },
  { room_number: '303', floor: 3, is_test: false, room_status: 'vacant', monthly_rent: 6000 },
  { room_number: '304', floor: 3, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '305', floor: 3, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '306', floor: 3, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  { room_number: '307', floor: 3, is_test: false, room_status: 'vacant', monthly_rent: 4500 },
  // Houses have no floor of their own; placed on floor 1 by convention.
  { room_number: 'H101', floor: 1, is_test: false, room_status: 'vacant', monthly_rent: 8500 },
  { room_number: 'H102', floor: 1, is_test: false, room_status: 'vacant', monthly_rent: 8500 },
  { room_number: 'H103', floor: 1, is_test: false, room_status: 'vacant', monthly_rent: 8500 },
  // The mock room. Floor 0, never on a production floor plan.
  { room_number: 'T01', floor: 0, is_test: true, room_status: 'occupied', monthly_rent: 6500 },
];

export interface SeedContract {
  room_number: string;
  tenant_id: string;
  is_test: boolean;
  status: string;
  monthly_rent: number;
  occupant_count: number;
  end_date: IsoDate;
}

export const seedContracts: SeedContract[] = [
  {
    room_number: '101',
    tenant_id: 't-101',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 2,
    end_date: '2026-12-31',
  },
  {
    room_number: '102',
    tenant_id: 't-102',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 1,
    end_date: '2027-01-31',
  },
  {
    room_number: '103',
    tenant_id: 't-103',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 3,
    end_date: '2026-12-31',
  },
  {
    room_number: '104',
    tenant_id: 't-104',
    is_test: false,
    status: 'active',
    monthly_rent: 4500,
    occupant_count: 2,
    end_date: '2027-02-28',
  },
  {
    room_number: '201',
    tenant_id: 't-201',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 1,
    end_date: '2026-12-31',
  },
  {
    room_number: '202',
    tenant_id: 't-202',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 2,
    end_date: '2027-03-31',
  },
  {
    room_number: '203',
    tenant_id: 't-203',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 1,
    end_date: '2026-09-15',
  },
  {
    room_number: '301',
    tenant_id: 't-301',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 2,
    end_date: '2026-12-31',
  },
  {
    room_number: '302',
    tenant_id: 't-302',
    is_test: false,
    status: 'active',
    monthly_rent: 6000,
    occupant_count: 4,
    end_date: '2026-09-30',
  },
  {
    room_number: 'T01',
    tenant_id: 't-T01',
    is_test: true,
    status: 'active',
    monthly_rent: 6500,
    occupant_count: 2,
    end_date: '2026-12-31',
  },
];

export interface SeedInvoice {
  room_number: string;
  is_test: boolean;
  billing_month: IsoDate;
  due_date: IsoDate;
  status: InvoiceStatus;
  total: number;
  paid_amount: number;
}

/**
 * August 2026 invoices. Totals are rent + electricity + water, matching the
 * meter readings in the seed.
 */
export const seedInvoices: SeedInvoice[] = [
  {
    room_number: '101',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'paid',
    total: 7360,
    paid_amount: 7360,
  },
  {
    room_number: '102',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'paid',
    total: 7000,
    paid_amount: 7000,
  },
  {
    room_number: '103',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'paid',
    total: 8000,
    paid_amount: 8000,
  },
  {
    room_number: '104',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'partially_paid',
    total: 5320,
    paid_amount: 3000,
  },
  {
    room_number: '201',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'paid',
    total: 7000,
    paid_amount: 7000,
  },
  {
    room_number: '202',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'paid',
    total: 7260,
    paid_amount: 7260,
  },
  {
    room_number: '203',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'overdue',
    total: 6720,
    paid_amount: 0,
  },
  {
    room_number: '301',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-05',
    status: 'paid',
    total: 7140,
    paid_amount: 7140,
  },
  {
    room_number: '302',
    is_test: false,
    billing_month: '2026-08-01',
    due_date: '2026-08-28',
    status: 'issued',
    total: 7340,
    paid_amount: 0,
  },
  // T01: rent 6,500 + electricity 1,040 + water 120 = 7,660, paid in full.
  {
    room_number: 'T01',
    is_test: true,
    billing_month: '2026-08-01',
    due_date: '2026-08-28',
    status: 'paid',
    total: 7660,
    paid_amount: 7660,
  },
];

export interface SeedPayment {
  room_number: string;
  is_test: boolean;
  payment_date: IsoDate;
  amount: number;
  status: string;
}

export const seedPayments: SeedPayment[] = [
  {
    room_number: '101',
    is_test: false,
    payment_date: '2026-08-03',
    amount: 7360,
    status: 'confirmed',
  },
  {
    room_number: '102',
    is_test: false,
    payment_date: '2026-08-04',
    amount: 7000,
    status: 'confirmed',
  },
  {
    room_number: '103',
    is_test: false,
    payment_date: '2026-08-02',
    amount: 8000,
    status: 'confirmed',
  },
  {
    room_number: '104',
    is_test: false,
    payment_date: '2026-08-05',
    amount: 3000,
    status: 'confirmed',
  },
  {
    room_number: '201',
    is_test: false,
    payment_date: '2026-08-05',
    amount: 7000,
    status: 'confirmed',
  },
  {
    room_number: '202',
    is_test: false,
    payment_date: '2026-08-01',
    amount: 7260,
    status: 'confirmed',
  },
  {
    room_number: '301',
    is_test: false,
    payment_date: '2026-08-04',
    amount: 7140,
    status: 'confirmed',
  },
  {
    room_number: 'T01',
    is_test: true,
    payment_date: '2026-08-05',
    amount: 7660,
    status: 'confirmed',
  },
];
