/**
 * Deterministic TypeScript mirror of supabase/seed.sql.
 *
 * The SQL is authoritative. These fixtures keep the reporting and exclusion
 * rules testable without connecting to a database.
 */

import type { InvoiceStatus, RoomStatus } from '@/types/database';
import { addDays, type IsoDate } from '@/lib/utils/date';

export const SEED_START_MONTH: IsoDate = '2025-01-01';
export const SEED_TODAY: IsoDate = '2026-09-06';
export const SEED_BILLING_MONTH: IsoDate = '2026-09-01';
export const SEED_MONTHLY_RENT = 3500;

export const SEED_MONTHS: IsoDate[] = Array.from({ length: 21 }, (_, index) => {
  const date = new Date(Date.UTC(2025, index, 1));
  return date.toISOString().slice(0, 10) as IsoDate;
});

export interface SeedRoom {
  room_number: string;
  floor: number;
  is_test: boolean;
  room_status: RoomStatus;
  monthly_rent: number;
}

const room = (
  roomNumber: string,
  floor: number,
  roomStatus: RoomStatus = 'occupied',
): SeedRoom => ({
  room_number: roomNumber,
  floor,
  is_test: false,
  room_status: roomStatus,
  monthly_rent: SEED_MONTHLY_RENT,
});

/** 24 real rooms (21 dorm rooms + 3 houses), plus isolated T01. */
export const seedRooms: SeedRoom[] = [
  room('101', 1),
  room('102', 1),
  room('103', 1),
  room('104', 1),
  room('105', 1),
  room('106', 1),
  room('107', 1, 'maintenance'),
  room('201', 2),
  room('202', 2),
  room('203', 2),
  room('204', 2),
  room('205', 2),
  room('206', 2),
  room('207', 2, 'vacant'),
  room('301', 3),
  room('302', 3),
  room('303', 3),
  room('304', 3),
  room('305', 3),
  room('306', 3),
  room('307', 3, 'vacant'),
  room('H101', 1),
  room('H102', 1),
  room('H103', 1, 'reserved'),
  {
    room_number: 'T01',
    floor: 0,
    is_test: true,
    room_status: 'occupied',
    monthly_rent: SEED_MONTHLY_RENT,
  },
];

export const OCCUPIED_REAL_ROOM_NUMBERS = seedRooms
  .filter((candidate) => !candidate.is_test && candidate.room_status === 'occupied')
  .map((candidate) => candidate.room_number);

const HISTORICAL_STAYS = [
  ['107', '107:2025-02', '2025-02-01', '2025-09-30'],
  ['107', '107:2025-11', '2025-11-01', '2026-05-31'],
  ['107', '107:2026-07', '2026-07-01', '2026-08-31'],
  ['207', '207:2025-03', '2025-03-01', '2025-08-31'],
  ['207', '207:2025-12', '2025-12-01', '2026-04-30'],
  ['307', '307:2025-04', '2025-04-01', '2025-07-31'],
  ['307', '307:2026-01', '2026-01-01', '2026-03-31'],
  ['H103', 'H103:2025-05', '2025-05-01', '2025-06-30'],
  ['H103', 'H103:2026-02', '2026-02-01', '2026-02-28'],
] as const satisfies ReadonlyArray<readonly [string, string, IsoDate, IsoDate]>;

const BILLABLE_REAL_ROOM_NUMBERS = [
  ...OCCUPIED_REAL_ROOM_NUMBERS,
  ...seedRooms
    .filter((candidate) => !candidate.is_test && candidate.room_status !== 'occupied')
    .map((candidate) => candidate.room_number)
    .sort(),
];

export interface SeedContract {
  room_number: string;
  tenant_id: string;
  is_test: boolean;
  status: string;
  monthly_rent: number;
  occupant_count: number;
  start_date: IsoDate;
  end_date: IsoDate;
}

export const seedContracts: SeedContract[] = [
  ...OCCUPIED_REAL_ROOM_NUMBERS.map((roomNumber, index) => ({
    room_number: roomNumber,
    tenant_id: `t-${roomNumber}`,
    is_test: false,
    status: 'active',
    monthly_rent: SEED_MONTHLY_RENT,
    occupant_count: 1 + ((index + 1) % 3),
    start_date: SEED_START_MONTH,
    end_date: '2027-12-31' as IsoDate,
  })),
  ...HISTORICAL_STAYS.map(([roomNumber, stayKey, startDate, endDate], index) => ({
    room_number: roomNumber,
    tenant_id: `t-${stayKey}`,
    is_test: false,
    status: 'expired',
    monthly_rent: SEED_MONTHLY_RENT,
    occupant_count: 1 + ((index + 1) % 3),
    start_date: startDate,
    end_date: endDate,
  })),
  {
    room_number: 'T01',
    tenant_id: 't-T01',
    is_test: true,
    status: 'active',
    monthly_rent: SEED_MONTHLY_RENT,
    occupant_count: 2,
    start_date: SEED_START_MONTH,
    end_date: '2027-12-31',
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

function realInvoiceTotal(roomRank: number) {
  const electricityUsage = 80 + (roomRank % 5) * 5;
  const waterUsage = 4 + (roomRank % 4);
  return SEED_MONTHLY_RENT + electricityUsage * 8 + waterUsage * 20;
}

export const seedInvoices: SeedInvoice[] = [
  ...SEED_MONTHS.flatMap((billingMonth) => {
    const activeContracts = seedContracts
      .filter(
        (contract) =>
          !contract.is_test &&
          contract.start_date <= billingMonth &&
          contract.end_date >= billingMonth,
      )
      .sort((left, right) => left.room_number.localeCompare(right.room_number));

    return activeContracts.map((contract, index) => {
      const roomNumber = contract.room_number;
      const roomRank = BILLABLE_REAL_ROOM_NUMBERS.indexOf(roomNumber) + 1;
      const total = realInvoiceTotal(roomRank);
      const isCurrent = billingMonth === SEED_BILLING_MONTH;
      const invoiceRank = index + 1;
      const paidAmount = isCurrent && invoiceRank === 19 ? total / 2 : total;

      return {
        room_number: roomNumber,
        is_test: false,
        billing_month: billingMonth,
        due_date: addDays(billingMonth, 4),
        status:
          isCurrent && invoiceRank === 20
            ? ('overdue' as const)
            : isCurrent && invoiceRank === 19
              ? ('partially_paid' as const)
              : ('paid' as const),
        total,
        paid_amount: isCurrent && invoiceRank === 20 ? 0 : paidAmount,
      };
    });
  }),
  {
    room_number: 'T01',
    is_test: true,
    billing_month: SEED_BILLING_MONTH,
    due_date: addDays(SEED_BILLING_MONTH, 4),
    status: 'paid',
    total: 4660,
    paid_amount: 4660,
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
  ...seedInvoices
    .filter((invoice) => !invoice.is_test && invoice.paid_amount > 0)
    .map((invoice) => {
      const roomRank =
        seedInvoices
          .filter(
            (candidate) => !candidate.is_test && candidate.billing_month === invoice.billing_month,
          )
          .findIndex((candidate) => candidate.room_number === invoice.room_number) + 1;
      return {
        room_number: invoice.room_number,
        is_test: false,
        payment_date: addDays(invoice.billing_month, 1 + (roomRank % 4)),
        amount: invoice.paid_amount,
        status: 'confirmed',
      };
    }),
  {
    room_number: 'T01',
    is_test: true,
    payment_date: SEED_TODAY,
    amount: 4660,
    status: 'confirmed',
  },
];
