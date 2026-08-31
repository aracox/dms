import 'server-only';

/**
 * The ONLY module allowed to fetch reporting data.
 *
 * Every query here reads a `report_*` view. Those views hard-filter
 * `is_test = false` in SQL, so there is no argument, flag or code path in this
 * file that can include the T01 mock room. Do not add a base-table query here,
 * and do not query a base table for a dashboard elsewhere -- add a `report_*`
 * view instead.
 *
 * `src/lib/reporting/exclusion.test.ts` scans this file and fails the build if a
 * non-report table name appears in a `.from(...)` call.
 */

import { createClient } from '@/lib/supabase/server';
import { currentBillingMonth, type IsoDate } from '@/lib/utils/date';
import type {
  AccessCardReportRow,
  ContractExpiringRow,
  FinanceSummaryRow,
  MaintenanceReportRow,
  MeterUsageRow,
  OutstandingRow,
  PaymentCollectionRow,
  RoomBoardRow,
  RoomSummaryRow,
  TenantSummaryRow,
} from '@/types/database';

const EMPTY_ROOM_SUMMARY: RoomSummaryRow = {
  total_rooms: 0,
  occupied: 0,
  vacant: 0,
  reserved: 0,
  maintenance: 0,
  occupancy_rate: 0,
};

/** Room counts and occupancy rate across the 24 real rooms. */
export async function getRoomSummary(): Promise<RoomSummaryRow> {
  const supabase = await createClient();
  const { data } = await supabase.from('report_room_summary').select('*').maybeSingle();
  return data ?? EMPTY_ROOM_SUMMARY;
}

const EMPTY_FINANCE_SUMMARY: FinanceSummaryRow = {
  billing_month: currentBillingMonth(),
  expected_rent: 0,
  invoiced_total: 0,
  collected_this_month: 0,
  outstanding: 0,
  overdue: 0,
};

/** Expected, invoiced, collected, outstanding and overdue money. */
export async function getFinanceSummary(): Promise<FinanceSummaryRow> {
  const supabase = await createClient();
  const { data } = await supabase.from('report_finance_summary').select('*').maybeSingle();
  return data ?? EMPTY_FINANCE_SUMMARY;
}

/** Registered tenants (one per contract) and total occupants. */
export async function getTenantSummary(): Promise<TenantSummaryRow> {
  const supabase = await createClient();
  const { data } = await supabase.from('report_tenant_summary').select('*').maybeSingle();
  return data ?? { registered_tenants: 0, total_occupants: 0 };
}

/** All 24 real rooms with contract, tenant and financial state. */
export async function getReportRooms(): Promise<RoomBoardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('report_rooms').select('*').order('room_number');
  return data ?? [];
}

/** Active contracts ending within `withinDays`. */
export async function getExpiringContracts(withinDays = 60): Promise<ContractExpiringRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_contracts_expiring')
    .select('*')
    .lte('days_remaining', withinDays)
    .order('end_date');
  return data ?? [];
}

/** Unsettled invoices, oldest due date first. */
export async function getOutstandingInvoices(limit = 50): Promise<OutstandingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_outstanding')
    .select('*')
    .order('due_date')
    .limit(limit);
  return data ?? [];
}

/** Invoices already past their due date. */
export async function getOverdueInvoices(limit = 50): Promise<OutstandingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_outstanding')
    .select('*')
    .gt('days_overdue', 0)
    .order('days_overdue', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Tickets that are not finished, highest priority first. */
export async function getOpenMaintenance(limit = 50): Promise<MaintenanceReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_maintenance')
    .select('*')
    .in('status', ['open', 'in_progress', 'waiting'])
    .limit(limit);
  return data ?? [];
}

export async function getMaintenanceReport(limit = 200): Promise<MaintenanceReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('report_maintenance').select('*').limit(limit);
  return data ?? [];
}

/** Cards reported lost, for the dashboard panel and the card report. */
export async function getLostCards(): Promise<AccessCardReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_access_cards')
    .select('*')
    .eq('status', 'lost')
    .order('room_number');
  return data ?? [];
}

export async function getAccessCardReport(): Promise<AccessCardReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('report_access_cards').select('*');
  return data ?? [];
}

/** Payment totals grouped by month and method. */
export async function getPaymentCollection(limit = 24): Promise<PaymentCollectionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_payment_collection')
    .select('*')
    .order('month', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Meter usage for one billing month, defaulting to the current one. */
export async function getMeterUsage(billingMonth?: IsoDate): Promise<MeterUsageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('report_meter_usage')
    .select('*')
    .eq('billing_month', billingMonth ?? currentBillingMonth());
  return data ?? [];
}

/**
 * Everything the dashboard needs, in parallel.
 * All five queries hit report_* views, so none of them can see T01.
 */
export async function getDashboardData() {
  const [rooms, finance, tenants, expiring, maintenance, lostCards, overdue] = await Promise.all([
    getRoomSummary(),
    getFinanceSummary(),
    getTenantSummary(),
    getExpiringContracts(60),
    getOpenMaintenance(10),
    getLostCards(),
    getOverdueInvoices(10),
  ]);

  return { rooms, finance, tenants, expiring, maintenance, lostCards, overdue };
}
