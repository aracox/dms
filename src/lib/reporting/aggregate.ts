/**
 * Pure aggregation mirroring the report_* SQL views.
 *
 * Used for previews and unit tests. The database views are authoritative --
 * see migration 0006.
 *
 * Every function here takes rows that have ALREADY been filtered. `excludeTest`
 * is the only sanctioned way to do that filtering, so the exclusion rule lives
 * in exactly one place on the TypeScript side.
 */

import type { InvoiceStatus, RoomStatus } from '@/types/database';
import { round2, subtractMoney, sumMoney } from '@/lib/billing/money';
import { bangkokToday, billingMonthOf, type IsoDate } from '@/lib/utils/date';

/**
 * Drop test rows. This is the ONLY place TypeScript decides what "real" means.
 *
 * Rooms flagged is_test (currently just T01) must never reach a report. See
 * CLAUDE.md rule 1.
 */
export function excludeTest<T extends { is_test: boolean }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !row.is_test);
}

export interface RoomAggregateInput {
  is_test: boolean;
  room_status: RoomStatus;
}

export interface RoomSummary {
  total_rooms: number;
  occupied: number;
  vacant: number;
  reserved: number;
  maintenance: number;
  occupancy_rate: number;
}

/** Mirrors report_room_summary. */
export function roomSummary(rooms: readonly RoomAggregateInput[]): RoomSummary {
  const real = excludeTest(rooms);
  const count = (status: RoomStatus) => real.filter((room) => room.room_status === status).length;

  const occupied = count('occupied');

  return {
    total_rooms: real.length,
    occupied,
    vacant: count('vacant'),
    reserved: count('reserved'),
    maintenance: count('maintenance'),
    occupancy_rate: real.length === 0 ? 0 : round2((occupied * 100) / real.length),
  };
}

export interface FinanceAggregateInput {
  contracts: readonly {
    is_test: boolean;
    status: string;
    monthly_rent: number;
  }[];
  invoices: readonly {
    is_test: boolean;
    billing_month: IsoDate;
    due_date: IsoDate;
    status: InvoiceStatus;
    total: number;
    paid_amount: number;
  }[];
  payments: readonly {
    is_test: boolean;
    payment_date: IsoDate;
    amount: number;
    status: string;
  }[];
  today?: IsoDate;
}

export interface FinanceSummary {
  billing_month: IsoDate;
  expected_rent: number;
  invoiced_total: number;
  collected_this_month: number;
  outstanding: number;
  overdue: number;
}

/** Mirrors report_finance_summary. */
export function financeSummary(input: FinanceAggregateInput): FinanceSummary {
  const today = input.today ?? bangkokToday();
  const month = billingMonthOf(today);

  const contracts = excludeTest(input.contracts);
  const invoices = excludeTest(input.invoices);
  const payments = excludeTest(input.payments);

  const expected_rent = sumMoney(
    contracts.filter((c) => c.status === 'active').map((c) => c.monthly_rent),
  );

  const invoiced_total = sumMoney(
    invoices
      .filter((i) => i.billing_month === month && i.status !== 'cancelled')
      .map((i) => i.total),
  );

  const collected_this_month = sumMoney(
    payments
      .filter((p) => p.status === 'confirmed' && billingMonthOf(p.payment_date) === month)
      .map((p) => p.amount),
  );

  // Outstanding and overdue span every month, not just the current one.
  const open = invoices.filter(
    (i) => i.status !== 'draft' && i.status !== 'cancelled' && i.status !== 'paid',
  );

  const outstanding = sumMoney(open.map((i) => subtractMoney(i.total, i.paid_amount)));

  const overdue = sumMoney(
    open.filter((i) => i.due_date < today).map((i) => subtractMoney(i.total, i.paid_amount)),
  );

  return {
    billing_month: month,
    expected_rent,
    invoiced_total,
    collected_this_month,
    outstanding,
    overdue,
  };
}

export interface TenantSummary {
  registered_tenants: number;
  total_occupants: number;
}

/** Mirrors report_tenant_summary. Counts the one registered person per contract. */
export function tenantSummary(
  contracts: readonly {
    is_test: boolean;
    status: string;
    tenant_id: string;
    occupant_count: number;
  }[],
): TenantSummary {
  const active = excludeTest(contracts).filter((c) => c.status === 'active');

  return {
    registered_tenants: new Set(active.map((c) => c.tenant_id)).size,
    total_occupants: active.reduce((sum, c) => sum + c.occupant_count, 0),
  };
}
