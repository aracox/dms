import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildMonthlyInvoiceItems, rentForMonth, rentPeriodLabel } from '@/lib/billing/calc';
import { contractEndedOn, contractsForBillingMonth } from '@/lib/contracts/status';
import { EXTRA_FEE_META, type InvoiceExtraFeeKey } from '@/lib/invoices/fees';
import {
  finalMeterLabel,
  finalMeterUsage,
  hasFinalMeterNumber,
  type UtilityMeter,
} from '@/lib/meters/tenancy';
import { propertySegment } from '@/lib/reporting/segments';
import { bangkokToday, invoiceDueDate, type IsoDate } from '@/lib/utils/date';
import type { Database, InvoiceItemType } from '@/types/database';

export interface GenerateInvoicesResult {
  error: string | null;
  /** Bills created by this call. */
  created: number;
}

/**
 * Which extra fees each new bill gets: the ones staff ticked, put on the bill
 * of the tenant in the room at month end; or each contract's own
 * subscriptions (bulk generation).
 */
export type InvoiceExtras = readonly InvoiceExtraFeeKey[] | 'subscriptions';

/** One of the rent / electricity / water lines a contract's bill carries. */
export type ChargeRow = {
  type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
  meter_reading_id: string | null;
  sort_order: number;
};

/**
 * Everything needed to work out a room's bills for one month: its contracts,
 * the month's live bills, the readings and the segment's rates -- and
 * `charges`, the rent and meter lines one contract's bill should carry.
 *
 * `excludeInvoiceId` leaves one bill out of "readings already billed", so a
 * bill being re-priced (refresh.ts) can keep the readings it carries itself.
 */
export async function loadRoomMonth(
  supabase: SupabaseClient<Database>,
  roomId: string,
  billingMonth: IsoDate,
  { excludeInvoiceId }: { excludeInvoiceId?: string } = {},
) {
  const [{ data: contracts }, { data: room }, { data: liveInvoices }] = await Promise.all([
    // Not just the active contract: a tenant who has already moved out still
    // owes the month they left in.
    supabase
      .from('contracts')
      .select(
        'id, monthly_rent, payment_due_day, status, start_date, end_date, terminated_at, created_at, meter_start_electricity, meter_start_water, meter_end_electricity, meter_end_water',
      )
      .eq('room_id', roomId)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false }),
    // The room's type decides which segment's fees apply -- a house is priced
    // from the บ้านพัก column, not the building-wide one that no longer exists.
    supabase.from('rooms').select('room_type').eq('id', roomId).maybeSingle(),
    supabase
      .from('invoices')
      .select('id, contract_id')
      .eq('room_id', roomId)
      .eq('billing_month', billingMonth)
      .neq('status', 'cancelled'),
  ]);

  if (!room) return null;

  const roomContracts = contracts ?? [];
  const monthContracts = contractsForBillingMonth(roomContracts, billingMonth);
  // The tenant in the room at month end: their bill carries the readings.
  const monthEndContract = monthContracts[0];
  const segment = propertySegment(room.room_type);
  const otherInvoiceIds = (liveInvoices ?? [])
    .map((invoice) => invoice.id)
    .filter((id) => id !== excludeInvoiceId);

  const [{ data: readings }, { data: carried }, { data: settingsRows }] = await Promise.all([
    // Earlier months too: a move-out's usage counts from the last reading.
    supabase
      .from('meter_readings')
      .select('*')
      .eq('room_id', roomId)
      .lte('billing_month', billingMonth)
      .in('meter_type', ['electricity', 'water'])
      .order('billing_month', { ascending: false })
      .limit(24),
    // Readings already on another live bill of this month are not billed twice.
    otherInvoiceIds.length
      ? supabase
          .from('invoice_items')
          .select('meter_reading_id')
          .in('invoice_id', otherInvoiceIds)
          .not('meter_reading_id', 'is', null)
      : Promise.resolve({ data: [] as { meter_reading_id: string | null }[] }),
    // The rates price a move-out's usage, which has no reading of its own.
    supabase.from('segment_settings').select('key, value').eq('segment', segment),
  ]);

  const setting = (key: string) => {
    const value = settingsRows?.find((row) => row.key === key)?.value;
    return typeof value === 'number' ? value : 0;
  };

  const carriedIds = new Set((carried ?? []).map((row) => row.meter_reading_id));
  const unbilledReading = (type: UtilityMeter) => {
    const reading = readings?.find(
      (row) => row.meter_type === type && row.billing_month === billingMonth,
    );
    return reading &&
      monthEndContract &&
      !carriedIds.has(reading.id) &&
      !hasFinalMeterNumber(monthEndContract, type, billingMonth)
      ? reading
      : undefined;
  };

  type RoomContract = (typeof roomContracts)[number];

  const utility = (contract: RoomContract, type: UtilityMeter) => {
    const final = finalMeterUsage({
      contract,
      type,
      billingMonth,
      readings: readings ?? [],
      contracts: roomContracts,
    });
    if (final) {
      return {
        ...final,
        rate: setting(`${type}_rate`),
        readingId: null,
        note: finalMeterLabel(final, contract.terminated_at!),
      };
    }
    const reading = contract.id === monthEndContract?.id ? unbilledReading(type) : undefined;
    return reading
      ? {
          previousReading: reading.previous_reading,
          currentReading: reading.current_reading,
          rate: reading.rate,
          readingId: reading.id,
          note: '',
        }
      : undefined;
  };

  /**
   * Rent prorated to the days the contract covers this month (rentForMonth),
   * plus its electricity and water: the usage up to move-out day for a tenant
   * who left with final numbers (finalMeterUsage), otherwise the month's
   * readings for the tenant in the room at month end -- unless they already
   * left with final numbers, or another live bill carries them.
   */
  const charges = (contract: RoomContract): ChargeRow[] => {
    const newer = roomContracts[roomContracts.indexOf(contract) - 1];
    const rent = rentForMonth({
      monthlyRent: contract.monthly_rent,
      billingMonth,
      startDate: contract.start_date,
      endedOn: contractEndedOn(contract, newer),
    });
    const electricity = utility(contract, 'electricity');
    const water = utility(contract, 'water');
    const items = buildMonthlyInvoiceItems({ monthlyRent: rent.amount, electricity, water });

    return items.map((item, index) => ({
      type: item.type,
      // A part month says which days it covers, e.g. "20/11–30/11 (11/30)";
      // a move-out's usage, its meter numbers.
      description:
        item.type === 'rent' && rent.days < rent.daysInMonth
          ? rentPeriodLabel(rent)
          : item.type === 'electricity'
            ? (electricity?.note ?? '')
            : item.type === 'water'
              ? (water?.note ?? '')
              : '',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      meter_reading_id:
        item.type === 'electricity'
          ? (electricity?.readingId ?? null)
          : item.type === 'water'
            ? (water?.readingId ?? null)
            : null,
      sort_order: index,
    }));
  };

  return { roomContracts, monthContracts, liveInvoices: liveInvoices ?? [], setting, charges };
}

/**
 * Generates a room's bills for one billing month: one per contract that
 * covers the month and has no live bill yet (see contractsForBillingMonth) --
 * so in a mid-month turnover the outgoing and the incoming tenant each get
 * their own, and running it again only fills in what is missing.
 *
 * Each bill carries loadRoomMonth's `charges` and falls due per
 * invoiceDueDate. sync_meter_reading_to_invoice (0046) follows the same
 * reading rule when a reading is corrected later, and refresh.ts re-prices a
 * bill the same way after its tenant moves out.
 *
 * Shared by the single-room form action and bulk generation, so both go
 * through the exact same rules and error codes. One live bill per contract
 * per month is enforced by invoices_one_live_per_contract_month_idx (0045);
 * recalc_invoice then totals the items this inserts.
 */
export async function generateInvoicesForRoom(
  supabase: SupabaseClient<Database>,
  {
    roomId,
    billingMonth,
    extras,
  }: { roomId: string; billingMonth: IsoDate; extras: InvoiceExtras },
): Promise<GenerateInvoicesResult> {
  const month = await loadRoomMonth(supabase, roomId, billingMonth);
  if (!month) return { error: 'errors.generic', created: 0 };

  const { monthContracts, liveInvoices, setting, charges } = month;
  if (monthContracts.length === 0) return { error: 'billing.noActiveContract', created: 0 };

  const billed = new Set(liveInvoices.map((invoice) => invoice.contract_id));
  const toBill = monthContracts.filter((contract) => !billed.has(contract.id));
  if (toBill.length === 0) return { error: 'billing.invoiceAlreadyExists', created: 0 };

  const monthEndContract = monthContracts[0]!;
  const { data: subscriptionRows } =
    extras === 'subscriptions'
      ? await supabase
          .from('contract_subscriptions')
          .select('contract_id, fee_key')
          .in(
            'contract_id',
            toBill.map((contract) => contract.id),
          )
      : { data: [] as { contract_id: string; fee_key: string }[] };

  const extrasFor = (contractId: string): InvoiceExtraFeeKey[] => {
    if (extras === 'subscriptions') {
      return (subscriptionRows ?? [])
        .filter((row) => row.contract_id === contractId)
        .map((row) => row.fee_key as InvoiceExtraFeeKey);
    }
    return contractId === monthEndContract.id ? [...extras] : [];
  };

  const issueDate = bangkokToday();
  let created = 0;

  for (const contract of toBill) {
    const { data: invoiceNumber, error: numberError } = await supabase.rpc('next_invoice_number', {
      p_billing_month: billingMonth,
    });
    if (numberError || !invoiceNumber) return { error: 'errors.generic', created };

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        room_id: roomId,
        contract_id: contract.id,
        billing_month: billingMonth,
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: invoiceDueDate(billingMonth, contract.payment_due_day, issueDate),
        status: 'issued',
      })
      .select('id')
      .single();

    if (invoiceError || !invoice) {
      return {
        error: invoiceError?.code === '23505' ? 'billing.invoiceAlreadyExists' : 'errors.generic',
        created,
      };
    }

    const chargeRows = charges(contract);
    const itemRows = chargeRows.map((row) => ({ ...row, invoice_id: invoice.id }));

    extrasFor(contract.id).forEach((key, index) => {
      const meta = EXTRA_FEE_META[key];
      itemRows.push({
        invoice_id: invoice.id,
        type: meta.type,
        description: meta.description,
        quantity: 1,
        unit_price: setting(key),
        meter_reading_id: null,
        sort_order: chargeRows.length + index,
      });
    });

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows);
    if (itemsError) return { error: 'errors.generic', created };
    created += 1;
  }

  return { error: null, created };
}
