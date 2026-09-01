import 'server-only';

/**
 * Operational room data access.
 *
 * Distinct from `lib/reporting/`: these queries read base tables and the
 * v_room_board view, and they CAN return the T01 test room -- Test Mode needs
 * exactly that. Every function therefore takes an explicit `includeTest`, which
 * defaults to false so forgetting it fails safe.
 *
 * Never use this module for a dashboard or report figure. Use lib/reporting.
 */

import { createClient } from '@/lib/supabase/server';
import { currentBillingMonth, type IsoDate } from '@/lib/utils/date';
import type {
  AccessCardEventRow,
  AccessCardRow,
  ContractRow,
  InvoiceItemRow,
  InvoiceRow,
  Json,
  MaintenanceTicketRow,
  MeterReadingRow,
  PaymentRow,
  RoomBoardRow,
  RoomRow,
  TenantRow,
} from '@/types/database';

/** Settings the room detail page's forms need: utility rates and the optional extra fees. */
const ROOM_DETAIL_SETTINGS_KEYS = [
  'electricity_rate',
  'water_rate',
  'internet_fee',
  'parking_fee_car',
  'parking_fee_motorcycle',
  'card_replacement_fee',
  'netflix_fee',
  'youtube_fee',
  'disney_fee',
  'viu_fee',
  'hbo_fee',
  'amazon_prime_fee',
  'default_payment_due_day',
] as const;

export interface RoomBoardOptions {
  floor?: number;
  /** Include rooms flagged is_test. Only Test Mode should pass true. */
  includeTest?: boolean;
}

/** Rooms for the floor plan and the rooms list. */
export async function getRoomBoard(options: RoomBoardOptions = {}): Promise<RoomBoardRow[]> {
  const supabase = await createClient();

  let query = supabase.from('v_room_board').select('*').order('room_number');

  if (!options.includeTest) query = query.eq('is_test', false);
  if (options.floor !== undefined) query = query.eq('floor', options.floor);

  const { data } = await query;
  return data ?? [];
}

export async function getRoomBoardRow(roomId: string): Promise<RoomBoardRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('v_room_board')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();
  return data ?? null;
}

export async function getRoomBoardByNumber(roomNumber: string): Promise<RoomBoardRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('v_room_board')
    .select('*')
    .eq('room_number', roomNumber)
    .maybeSingle();
  return data ?? null;
}

export interface InvoiceWithItems extends InvoiceRow {
  items: InvoiceItemRow[];
  payments: PaymentRow[];
}

export interface RoomDetail {
  room: RoomRow;
  board: RoomBoardRow | null;
  contract: ContractRow | null;
  tenant: TenantRow | null;
  contractHistory: ContractRow[];
  cards: AccessCardRow[];
  cardEvents: AccessCardEventRow[];
  meterReadings: MeterReadingRow[];
  invoices: InvoiceWithItems[];
  tickets: MaintenanceTicketRow[];
  /** Utility rates and optional extra fees, keyed by settings.key. See ROOM_DETAIL_SETTINGS_KEYS. */
  settings: Record<string, Json>;
}

/**
 * Everything the room detail page shows, in as few round trips as the free tier
 * is happy with. Returns null when the room does not exist.
 */
export async function getRoomDetail(roomId: string): Promise<RoomDetail | null> {
  const supabase = await createClient();

  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return null;

  const [board, contracts, cards, meterReadings, invoices, tickets, settingsRows] =
    await Promise.all([
      getRoomBoardRow(roomId),
      supabase
        .from('contracts')
        .select('*')
        .eq('room_id', roomId)
        .order('start_date', { ascending: false }),
      supabase.from('access_cards').select('*').eq('room_id', roomId).order('card_number'),
      supabase
        .from('meter_readings')
        .select('*')
        .eq('room_id', roomId)
        .order('billing_month', { ascending: false })
        .limit(24),
      supabase
        .from('invoices')
        .select('*')
        .eq('room_id', roomId)
        .order('billing_month', { ascending: false })
        .limit(12),
      supabase
        .from('maintenance_tickets')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('settings').select('key, value').in('key', ROOM_DETAIL_SETTINGS_KEYS),
    ]);

  const contractRows = contracts.data ?? [];
  const activeContract = contractRows.find((contract) => contract.status === 'active') ?? null;
  const cardRows = cards.data ?? [];
  const invoiceRows = invoices.data ?? [];

  // Items, payments, the tenant and card history all depend on the ids above,
  // so they form a second parallel wave rather than a per-row waterfall.
  const invoiceIds = invoiceRows.map((invoice) => invoice.id);
  const cardIds = cardRows.map((card) => card.id);

  const [tenant, items, payments, cardEvents] = await Promise.all([
    activeContract
      ? supabase.from('tenants').select('*').eq('id', activeContract.tenant_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoiceIds.length
      ? supabase.from('invoice_items').select('*').in('invoice_id', invoiceIds).order('sort_order')
      : Promise.resolve({ data: [] as InvoiceItemRow[] }),
    invoiceIds.length
      ? supabase
          .from('payments')
          .select('*')
          .in('invoice_id', invoiceIds)
          .order('payment_date', { ascending: false })
      : Promise.resolve({ data: [] as PaymentRow[] }),
    cardIds.length
      ? supabase
          .from('access_card_events')
          .select('*')
          .in('card_id', cardIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as AccessCardEventRow[] }),
  ]);

  const itemRows = items.data ?? [];
  const paymentRows = payments.data ?? [];

  return {
    room,
    board,
    contract: activeContract,
    tenant: tenant.data ?? null,
    contractHistory: contractRows,
    cards: cardRows,
    cardEvents: cardEvents.data ?? [],
    meterReadings: meterReadings.data ?? [],
    invoices: invoiceRows.map((invoice) => ({
      ...invoice,
      items: itemRows.filter((item) => item.invoice_id === invoice.id),
      payments: paymentRows.filter((payment) => payment.invoice_id === invoice.id),
    })),
    tickets: tickets.data ?? [],
    settings: Object.fromEntries((settingsRows.data ?? []).map((row) => [row.key, row.value])),
  };
}

/** Current utility rates, for pre-filling the meter entry form. */
export async function getUtilityRates(): Promise<{ electricity: number; water: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['electricity_rate', 'water_rate']);

  const read = (key: string, fallback: number) => {
    const value = data?.find((row) => row.key === key)?.value;
    return typeof value === 'number' ? value : fallback;
  };

  return { electricity: read('electricity_rate', 8), water: read('water_rate', 20) };
}

/** Latest reading per meter for a room, used as the next month's opening value. */
export async function getLatestReadings(
  roomId: string,
  billingMonth: IsoDate = currentBillingMonth(),
): Promise<Partial<Record<'electricity' | 'water', MeterReadingRow>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('room_id', roomId)
    .lte('billing_month', billingMonth)
    .order('billing_month', { ascending: false });

  const result: Partial<Record<'electricity' | 'water', MeterReadingRow>> = {};
  for (const reading of data ?? []) {
    if (!result[reading.meter_type]) result[reading.meter_type] = reading;
  }
  return result;
}
