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

import type { PostgrestError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { currentBillingMonth, type IsoDate } from '@/lib/utils/date';
import type {
  AccessCardReportRow,
  BusinessOverviewBySegmentRow,
  BusinessOverviewRow,
  ContractExpiringRow,
  FinanceSummaryRow,
  MaintenanceReportRow,
  MeterUsageRow,
  OutstandingRow,
  PaymentCollectionRow,
  PropertySegment,
  ReportRoomRow,
  RoomSummaryRow,
  TenantSummaryRow,
} from '@/types/database';
import { bySegment } from './segments';

/**
 * A broken reporting read must never look like a real zero.
 *
 * These functions used to discard `error` and fall back to an empty value, so
 * an unapplied migration reached the dashboard as "24 units -- 0 dorm rooms and
 * 0 houses" instead of as a failure. Throw, and let the error boundary say so.
 * The empty constants below are for a view that legitimately returned no row,
 * such as a segment with no rooms yet.
 */
function reportingError(view: string, error: PostgrestError): Error {
  return new Error(
    `reporting: query on ${view} failed -- ${error.message}` +
      (error.hint ? ` (hint: ${error.hint})` : ''),
    { cause: error },
  );
}

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
  const { data, error } = await supabase.from('report_room_summary').select('*').maybeSingle();
  if (error) throw reportingError('report_room_summary', error);
  return data ?? EMPTY_ROOM_SUMMARY;
}

/** Room counts and occupancy rate for หอพัก and บ้านพัก separately. */
export async function getRoomSummaryBySegment(): Promise<Record<PropertySegment, RoomSummaryRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_room_summary_by_segment').select('*');
  if (error) throw reportingError('report_room_summary_by_segment', error);
  return bySegment(data ?? [], () => EMPTY_ROOM_SUMMARY);
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
  const { data, error } = await supabase.from('report_finance_summary').select('*').maybeSingle();
  if (error) throw reportingError('report_finance_summary', error);
  return data ?? EMPTY_FINANCE_SUMMARY;
}

/** Expected, invoiced, collected, outstanding and overdue money, per segment. */
export async function getFinanceSummaryBySegment(): Promise<
  Record<PropertySegment, FinanceSummaryRow>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_finance_summary_by_segment').select('*');
  if (error) throw reportingError('report_finance_summary_by_segment', error);
  return bySegment(data ?? [], () => EMPTY_FINANCE_SUMMARY);
}

/** Monthly occupancy, billing, collections, and common expenses. */
export async function getBusinessOverview(): Promise<BusinessOverviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_business_overview')
    .select('*')
    .order('billing_month');
  if (error) throw reportingError('report_business_overview', error);
  return data ?? [];
}

/**
 * Monthly occupancy, billing and collections per segment. Common expenses are
 * building-wide and stay on `getBusinessOverview`.
 */
export async function getBusinessOverviewBySegment(): Promise<BusinessOverviewBySegmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_business_overview_by_segment')
    .select('*')
    .order('billing_month');
  if (error) throw reportingError('report_business_overview_by_segment', error);
  return data ?? [];
}

const EMPTY_TENANT_SUMMARY: TenantSummaryRow = { registered_tenants: 0, total_occupants: 0 };

/** Registered tenants (one per contract) and total occupants. */
export async function getTenantSummary(): Promise<TenantSummaryRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_tenant_summary').select('*').maybeSingle();
  if (error) throw reportingError('report_tenant_summary', error);
  return data ?? EMPTY_TENANT_SUMMARY;
}

/** Registered tenants and total occupants, per segment. */
export async function getTenantSummaryBySegment(): Promise<
  Record<PropertySegment, TenantSummaryRow>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_tenant_summary_by_segment').select('*');
  if (error) throw reportingError('report_tenant_summary_by_segment', error);
  return bySegment(data ?? [], () => EMPTY_TENANT_SUMMARY);
}

/** All 24 real rooms with contract, tenant and financial state. */
export async function getReportRooms(): Promise<ReportRoomRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_rooms').select('*').order('room_number');
  if (error) throw reportingError('report_rooms', error);
  return data ?? [];
}

/** Active contracts ending within `withinDays`. */
export async function getExpiringContracts(withinDays = 60): Promise<ContractExpiringRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_contracts_expiring')
    .select('*')
    .lte('days_remaining', withinDays)
    .order('end_date');
  if (error) throw reportingError('report_contracts_expiring', error);
  return data ?? [];
}

/** Unsettled invoices, oldest due date first. */
export async function getOutstandingInvoices(limit = 50): Promise<OutstandingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_outstanding')
    .select('*')
    .order('due_date')
    .limit(limit);
  if (error) throw reportingError('report_outstanding', error);
  return data ?? [];
}

/** Invoices already past their due date. */
export async function getOverdueInvoices(limit = 50): Promise<OutstandingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_outstanding')
    .select('*')
    .gt('days_overdue', 0)
    .order('days_overdue', { ascending: false })
    .limit(limit);
  if (error) throw reportingError('report_outstanding', error);
  return data ?? [];
}

/** Tickets that are not finished, highest priority first. */
export async function getOpenMaintenance(limit = 50): Promise<MaintenanceReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_maintenance')
    .select('*')
    .in('status', ['open', 'in_progress', 'waiting'])
    .limit(limit);
  if (error) throw reportingError('report_maintenance', error);
  return data ?? [];
}

export async function getMaintenanceReport(limit = 200): Promise<MaintenanceReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_maintenance').select('*').limit(limit);
  if (error) throw reportingError('report_maintenance', error);
  return data ?? [];
}

/** Cards reported lost, for the dashboard panel and the card report. */
export async function getLostCards(): Promise<AccessCardReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_access_cards')
    .select('*')
    .eq('status', 'lost')
    .order('room_number');
  if (error) throw reportingError('report_access_cards', error);
  return data ?? [];
}

export async function getAccessCardReport(): Promise<AccessCardReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('report_access_cards').select('*');
  if (error) throw reportingError('report_access_cards', error);
  return data ?? [];
}

/** Payment totals grouped by month and method. */
export async function getPaymentCollection(limit = 24): Promise<PaymentCollectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_payment_collection')
    .select('*')
    .order('month', { ascending: false })
    .limit(limit);
  if (error) throw reportingError('report_payment_collection', error);
  return data ?? [];
}

/** Meter usage for one billing month, defaulting to the current one. */
export async function getMeterUsage(billingMonth?: IsoDate): Promise<MeterUsageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_meter_usage')
    .select('*')
    .eq('billing_month', billingMonth ?? currentBillingMonth());
  if (error) throw reportingError('report_meter_usage', error);
  return data ?? [];
}

/**
 * Everything the dashboard needs, in parallel.
 * Every query hits a report_* view, so none of them can see T01.
 */
export async function getDashboardData() {
  const [
    rooms,
    roomsBySegment,
    finance,
    financeBySegment,
    overview,
    overviewBySegment,
    tenants,
    tenantsBySegment,
    expiring,
    maintenance,
    lostCards,
    overdue,
  ] = await Promise.all([
    getRoomSummary(),
    getRoomSummaryBySegment(),
    getFinanceSummary(),
    getFinanceSummaryBySegment(),
    getBusinessOverview(),
    getBusinessOverviewBySegment(),
    getTenantSummary(),
    getTenantSummaryBySegment(),
    getExpiringContracts(60),
    getOpenMaintenance(10),
    getLostCards(),
    getOverdueInvoices(10),
  ]);

  return {
    rooms,
    roomsBySegment,
    finance,
    financeBySegment,
    overview,
    overviewBySegment,
    tenants,
    tenantsBySegment,
    expiring,
    maintenance,
    lostCards,
    overdue,
  };
}
