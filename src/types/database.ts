/**
 * Supabase schema types.
 *
 * Hand-maintained to match supabase/migrations/*.sql. Once the project is
 * created, prefer regenerating:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Columns that the database computes are present in `Row` but deliberately
 * absent from `Insert` / `Update`, so a client cannot try to write them:
 *   - meter_readings.usage / .amount   (generated)
 *   - invoice_items.amount             (generated)
 *   - invoices.subtotal / .discount / .total  (trigger-maintained)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// --- Enums -----------------------------------------------------------------

export type AppRole = 'owner' | 'admin' | 'staff';

export type RoomStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance';

export type RoomType = 'standard' | 'air_conditioned' | 'studio' | 'house';

/**
 * หอพัก (dorm rooms) vs บ้านพัก (standalone houses). Derived from room_type by
 * `room_property_segment()` in migration 0024, never stored on a row.
 */
export type PropertySegment = 'dorm' | 'house';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export type CardStatus = 'available' | 'active' | 'lost' | 'disabled' | 'damaged' | 'returned';

export type CardAction =
  'issue' | 'activate' | 'disable' | 'report_lost' | 'replace' | 'return' | 'mark_damaged';

export type MeterType = 'electricity' | 'water';

export type InvoiceStatus =
  'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export type InvoiceItemType =
  'rent' | 'electricity' | 'water' | 'internet' | 'parking' | 'other' | 'discount';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'promptpay';

export type PaymentStatus = 'pending' | 'confirmed' | 'cancelled';

export type MaintenanceStatus = 'open' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export type AuditAction = 'insert' | 'update' | 'delete';

export type CommonExpenseCategory =
  | 'common_electricity'
  | 'common_water'
  | 'housekeeping'
  | 'gardening'
  | 'internet'
  | 'transformer_fee'
  | 'other';

/** Derived on the server in v_room_board, not stored. */
export type FinancialStatus = 'none' | 'paid' | 'payment_due' | 'overdue';

// --- Row shapes ------------------------------------------------------------

export type ProfileRow = {
  id: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type SettingRow = {
  key: string;
  value: Json;
  description: string | null;
  /** 0025: true when segment_settings holds the value and this one is frozen. */
  is_segment_scoped: boolean;
  updated_at: string;
  updated_by: string | null;
};

/** Written only by the `on_settings_value_changed` trigger. Audit/reference only. */
export type SettingsHistoryRow = {
  id: string;
  key: string;
  old_value: Json | null;
  new_value: Json;
  changed_by: string | null;
  changed_at: string;
};

/**
 * One value per (segment-scoped setting, segment) -- migration 0025.
 *
 * Authoritative for every key where `settings.is_segment_scoped` is true;
 * `settings.value` is frozen for those. Both segments are always present, so a
 * lookup that finds nothing means the schema drifted, not that a default
 * applies -- there is no shared fallback by design.
 */
export type SegmentSettingRow = {
  key: string;
  segment: PropertySegment;
  value: Json;
  updated_at: string;
  updated_by: string | null;
};

/** Written only by the `on_segment_settings_value_changed` trigger. Audit only. */
export type SegmentSettingsHistoryRow = {
  id: string;
  key: string;
  segment: PropertySegment;
  old_value: Json | null;
  new_value: Json;
  changed_by: string | null;
  changed_at: string;
};

export type RoomRow = {
  id: string;
  room_number: string;
  floor: number;
  room_type: RoomType;
  monthly_rent: number;
  deposit: number;
  status: RoomStatus;
  size_sqm: number | null;
  notes: string | null;
  car_plate: string | null;
  motorcycle_plate: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type TenantRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  id_card_or_passport: string | null;
  nationality: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  line_id: string | null;
  /** Real LINE Messaging API userId, captured via webhook. Null until linked. */
  line_user_id: string | null;
  /** One-time code given to the tenant so the webhook can match them. Cleared once linked. */
  line_link_code: string | null;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

/** Row in line_reminders_sent -- dedup log for the LINE reminder sweep. */
export type LineReminderSentRow = {
  id: string;
  entity_type: 'invoice_due' | 'contract_expiring';
  entity_id: string;
  tenant_id: string;
  sent_at: string;
};

/** Tracks files under the tenant-documents storage bucket (0008). */
export type TenantDocumentRow = {
  id: string;
  tenant_id: string;
  storage_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
};

export type ContractRow = {
  id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number;
  payment_due_day: number;
  /** Total occupants INCLUDING the main tenant. */
  occupant_count: number;
  status: ContractStatus;
  terminated_at: string | null;
  termination_reason: string | null;
  notes: string | null;
  /** Withheld from the deposit for damages/unpaid dues. 0 until settled. */
  deposit_deduction: number;
  /** Null until settled: deposit - deposit_deduction, floored at 0. */
  deposit_refund: number | null;
  deposit_settled_at: string | null;
  deposit_settlement_note: string | null;
  /** When the tenant told staff they're leaving early. Null until notice is given. */
  notice_given_at: string | null;
  /** The date the tenant said they will vacate. Independent of end_date. */
  planned_move_out_date: string | null;
  notice_note: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type RoomReservationStatus = 'held' | 'applied' | 'forfeited';

export type RoomReservationRow = {
  id: string;
  room_id: string;
  prospect_name: string;
  prospect_phone: string | null;
  amount: number;
  status: RoomReservationStatus;
  note: string | null;
  /** Set once status becomes 'applied' -- the contract the fee was credited toward. */
  applied_contract_id: string | null;
  resolved_at: string | null;
  is_test: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Row presence = subscribed. See fee_key's check constraint for the allowed set. */
export type ContractSubscriptionRow = {
  id: string;
  contract_id: string;
  fee_key: string;
  is_test: boolean;
  created_at: string;
};

export type AccessCardRow = {
  id: string;
  room_id: string;
  card_number: string;
  card_uid: string | null;
  status: CardStatus;
  issued_date: string | null;
  returned_date: string | null;
  replacement_fee: number;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type AccessCardEventRow = {
  id: string;
  card_id: string;
  action: CardAction;
  from_status: CardStatus | null;
  to_status: CardStatus;
  fee: number;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

export type MeterReadingRow = {
  id: string;
  room_id: string;
  meter_type: MeterType;
  billing_month: string;
  previous_reading: number;
  current_reading: number;
  rate: number;
  /** Generated: current_reading - previous_reading. */
  usage: number;
  /** Generated: round(usage * rate, 2). */
  amount: number;
  note: string | null;
  recorded_at: string;
  recorded_by: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceRow = {
  id: string;
  room_id: string;
  contract_id: string | null;
  billing_month: string;
  invoice_number: string;
  issue_date: string | null;
  due_date: string;
  /** Trigger-maintained from invoice_items. */
  subtotal: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
  /** Generated: round(quantity * unit_price, 2). */
  amount: number;
  meter_reading_id: string | null;
  sort_order: number;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference: string | null;
  slip_path: string | null;
  status: PaymentStatus;
  note: string | null;
  recorded_by: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type MaintenanceTicketRow = {
  id: string;
  /** Null for common-area tickets. */
  room_id: string | null;
  category: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  cost: number | null;
  technician: string | null;
  photo_path: string | null;
  reported_by: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CommonExpenseRow = {
  id: string;
  category: CommonExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string;
  /** Required for the 4 recurring categories; null for ad hoc ('other') rows. */
  billing_month: string | null;
  recorded_by: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: AuditAction;
  old_value: Json | null;
  new_value: Json | null;
  created_at: string;
};

// --- Views -----------------------------------------------------------------

/** v_room_board. Includes test rooms; filter on is_test. */
export type RoomBoardRow = {
  room_id: string;
  room_number: string;
  floor: number;
  room_type: RoomType;
  room_status: RoomStatus;
  monthly_rent: number;
  deposit: number;
  is_test: boolean;

  contract_id: string | null;
  contract_status: ContractStatus | null;
  start_date: string | null;
  end_date: string | null;
  occupant_count: number | null;
  payment_due_day: number | null;

  tenant_id: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;

  invoice_id: string | null;
  invoice_number: string | null;
  billing_month: string | null;
  due_date: string | null;
  invoice_status: InvoiceStatus | null;
  invoice_total: number;
  paid_amount: number;
  outstanding: number;

  financial_status: FinancialStatus;

  open_maintenance_count: number;
  lost_card_count: number;
  active_card_count: number;
  total_card_count: number;

  notice_given_at: string | null;
  planned_move_out_date: string | null;
};

/** report_rooms. v_room_board minus test rooms, plus the derived segment (0024). */
export type ReportRoomRow = RoomBoardRow & {
  property_segment: PropertySegment;
};

export type RoomSummaryRow = {
  total_rooms: number;
  occupied: number;
  vacant: number;
  reserved: number;
  maintenance: number;
  occupancy_rate: number;
};

export type FinanceSummaryRow = {
  billing_month: string;
  expected_rent: number;
  invoiced_total: number;
  collected_this_month: number;
  outstanding: number;
  overdue: number;
};

export type BusinessOverviewRow = {
  billing_month: string;
  occupied_rooms: number;
  total_rooms: number;
  occupancy_rate: number;
  billed_amount: number;
  collected_amount: number;
  expense_amount: number;
  net_after_expenses: number;
  collection_rate: number;
};

/**
 * report_business_overview_by_segment. No expense or net column: common
 * expenses are building-wide and are not attributable to one segment.
 */
export type BusinessOverviewBySegmentRow = {
  billing_month: string;
  segment: PropertySegment;
  occupied_rooms: number;
  total_rooms: number;
  occupancy_rate: number;
  billed_amount: number;
  collected_amount: number;
  collection_rate: number;
};

export type ContractExpiringRow = {
  contract_id: string;
  room_id: string;
  room_number: string;
  floor: number;
  tenant_name: string;
  tenant_phone: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  occupant_count: number;
  days_remaining: number;
  property_segment: PropertySegment;
};

/** report_move_out_notices. Active contracts whose tenant has given move-out notice. */
export type MoveOutNoticeRow = {
  contract_id: string;
  room_id: string;
  room_number: string;
  floor: number;
  tenant_name: string;
  tenant_phone: string;
  notice_given_at: string;
  planned_move_out_date: string;
  notice_note: string | null;
  days_remaining: number;
  property_segment: PropertySegment;
};

export type OutstandingRow = {
  invoice_id: string;
  invoice_number: string;
  billing_month: string;
  due_date: string;
  status: InvoiceStatus;
  room_id: string;
  room_number: string;
  floor: number;
  tenant_name: string | null;
  total: number;
  paid_amount: number;
  outstanding: number;
  days_overdue: number;
  property_segment: PropertySegment;
};

export type PaymentCollectionRow = {
  month: string;
  payment_method: PaymentMethod;
  payment_count: number;
  total_amount: number;
};

export type MeterUsageRow = {
  billing_month: string;
  meter_type: MeterType;
  room_id: string;
  room_number: string;
  floor: number;
  previous_reading: number;
  current_reading: number;
  usage: number;
  rate: number;
  amount: number;
};

export type MaintenanceReportRow = {
  ticket_id: string;
  room_id: string | null;
  room_number: string | null;
  floor: number | null;
  category: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  cost: number | null;
  technician: string | null;
  created_at: string;
  completed_at: string | null;
  /** Null for a common-area ticket, which belongs to no segment. */
  property_segment: PropertySegment | null;
};

export type AccessCardReportRow = {
  card_id: string;
  room_id: string;
  room_number: string;
  floor: number;
  card_number: string;
  card_uid: string | null;
  status: CardStatus;
  issued_date: string | null;
  returned_date: string | null;
  replacement_fee: number;
  property_segment: PropertySegment;
};

export type TenantSummaryRow = {
  registered_tenants: number;
  total_occupants: number;
};

// --- Per-segment reporting views (0024) ------------------------------------

export type RoomSummaryBySegmentRow = RoomSummaryRow & {
  segment: PropertySegment;
};

export type FinanceSummaryBySegmentRow = FinanceSummaryRow & {
  segment: PropertySegment;
};

export type TenantSummaryBySegmentRow = TenantSummaryRow & {
  segment: PropertySegment;
};

// --- Client schema ---------------------------------------------------------

/** Helper: writable shape = Row minus server-computed and identity columns. */
type Writable<TRow, TComputed extends keyof TRow = never> = Omit<
  TRow,
  'created_at' | 'updated_at' | TComputed
>;

/**
 * postgrest-js requires Row/Insert/Update to each satisfy
 * `Record<string, unknown>`. Using `never` for an append-only table's Update
 * silently breaks the GenericSchema constraint and every query degrades to
 * `never`, so append-only tables use `NoWrites` instead: an object type that
 * accepts no properties, which rejects `.update({...})` at the call site.
 */
type NoWrites = Record<string, never>;

type TableDef<
  TRow extends Record<string, unknown>,
  TInsert extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> = {
  Row: TRow;
  Insert: TInsert;
  Update: TUpdate;
  Relationships: [];
};

type ViewDef<TRow extends Record<string, unknown>> = { Row: TRow; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Partial<Writable<ProfileRow>> & { id: string },
        Partial<Writable<ProfileRow>>
      >;
      settings: TableDef<
        SettingRow,
        Partial<Omit<SettingRow, 'updated_at'>> & { key: string; value: Json },
        Partial<Omit<SettingRow, 'updated_at'>>
      >;
      rooms: TableDef<
        RoomRow,
        Partial<Writable<RoomRow, 'id'>> & { room_number: string; floor: number },
        Partial<Writable<RoomRow, 'id'>>
      >;
      tenants: TableDef<
        TenantRow,
        Partial<Writable<TenantRow, 'id'>> & { full_name: string; phone: string },
        Partial<Writable<TenantRow, 'id'>>
      >;
      tenant_documents: TableDef<
        TenantDocumentRow,
        Partial<Omit<TenantDocumentRow, 'id' | 'created_at'>> & {
          tenant_id: string;
          storage_path: string;
          file_name: string;
        },
        NoWrites
      >;
      line_reminders_sent: TableDef<
        LineReminderSentRow,
        Partial<Omit<LineReminderSentRow, 'id' | 'sent_at'>> & {
          entity_type: 'invoice_due' | 'contract_expiring';
          entity_id: string;
          tenant_id: string;
        },
        NoWrites
      >;
      contracts: TableDef<
        ContractRow,
        Partial<Writable<ContractRow, 'id'>> & {
          room_id: string;
          tenant_id: string;
          start_date: string;
          end_date: string;
          monthly_rent: number;
        },
        Partial<Writable<ContractRow, 'id'>>
      >;
      room_reservations: TableDef<
        RoomReservationRow,
        Partial<Writable<RoomReservationRow, 'id'>> & {
          room_id: string;
          prospect_name: string;
          amount: number;
        },
        Partial<Writable<RoomReservationRow, 'id'>>
      >;
      contract_subscriptions: TableDef<
        ContractSubscriptionRow,
        Partial<Omit<ContractSubscriptionRow, 'id' | 'created_at'>> & {
          contract_id: string;
          fee_key: string;
        },
        NoWrites
      >;
      access_cards: TableDef<
        AccessCardRow,
        Partial<Writable<AccessCardRow, 'id'>> & { room_id: string; card_number: string },
        Partial<Writable<AccessCardRow, 'id'>>
      >;
      access_card_events: TableDef<
        AccessCardEventRow,
        Partial<Omit<AccessCardEventRow, 'id' | 'created_at'>> & {
          card_id: string;
          action: CardAction;
          to_status: CardStatus;
        },
        NoWrites
      >;
      meter_readings: TableDef<
        MeterReadingRow,
        Partial<Writable<MeterReadingRow, 'id' | 'usage' | 'amount'>> & {
          room_id: string;
          meter_type: MeterType;
          billing_month: string;
          previous_reading: number;
          current_reading: number;
          rate: number;
        },
        Partial<Writable<MeterReadingRow, 'id' | 'usage' | 'amount'>>
      >;
      invoices: TableDef<
        InvoiceRow,
        Partial<Writable<InvoiceRow, 'id' | 'subtotal' | 'discount' | 'total'>> & {
          room_id: string;
          billing_month: string;
          invoice_number: string;
          due_date: string;
        },
        Partial<Writable<InvoiceRow, 'id' | 'subtotal' | 'discount' | 'total'>>
      >;
      invoice_items: TableDef<
        InvoiceItemRow,
        Partial<Omit<InvoiceItemRow, 'id' | 'amount' | 'created_at'>> & {
          invoice_id: string;
          type: InvoiceItemType;
          unit_price: number;
        },
        Partial<Omit<InvoiceItemRow, 'id' | 'amount' | 'created_at'>>
      >;
      payments: TableDef<
        PaymentRow,
        // 'id' is insertable (not just server-generated) so the slip's storage
        // path -- which is keyed by payment id -- can be uploaded before the
        // row exists and included in one insert.
        Partial<Writable<PaymentRow>> & {
          invoice_id: string;
          payment_date: string;
          amount: number;
          payment_method: PaymentMethod;
        },
        Partial<Writable<PaymentRow, 'id'>>
      >;
      maintenance_tickets: TableDef<
        MaintenanceTicketRow,
        Partial<Writable<MaintenanceTicketRow, 'id'>> & { category: string; description: string },
        Partial<Writable<MaintenanceTicketRow, 'id'>>
      >;
      common_expenses: TableDef<
        CommonExpenseRow,
        Partial<Writable<CommonExpenseRow, 'id'>> & {
          category: CommonExpenseCategory;
          amount: number;
          expense_date: string;
        },
        Partial<Writable<CommonExpenseRow, 'id'>>
      >;
      audit_logs: TableDef<
        AuditLogRow,
        Partial<Omit<AuditLogRow, 'id' | 'created_at'>> & {
          entity_type: string;
          action: AuditAction;
        },
        NoWrites
      >;
      settings_history: TableDef<SettingsHistoryRow, NoWrites, NoWrites>;
      segment_settings: TableDef<
        SegmentSettingRow,
        Partial<Omit<SegmentSettingRow, 'updated_at'>> & {
          key: string;
          segment: PropertySegment;
          value: Json;
        },
        Partial<Omit<SegmentSettingRow, 'updated_at'>>
      >;
      segment_settings_history: TableDef<SegmentSettingsHistoryRow, NoWrites, NoWrites>;
    };
    Views: {
      v_room_board: ViewDef<RoomBoardRow>;
      report_rooms: ViewDef<ReportRoomRow>;
      report_room_summary: ViewDef<RoomSummaryRow>;
      report_room_summary_by_segment: ViewDef<RoomSummaryBySegmentRow>;
      report_finance_summary: ViewDef<FinanceSummaryRow>;
      report_finance_summary_by_segment: ViewDef<FinanceSummaryBySegmentRow>;
      report_business_overview: ViewDef<BusinessOverviewRow>;
      report_business_overview_by_segment: ViewDef<BusinessOverviewBySegmentRow>;
      report_contracts_expiring: ViewDef<ContractExpiringRow>;
      report_move_out_notices: ViewDef<MoveOutNoticeRow>;
      report_outstanding: ViewDef<OutstandingRow>;
      report_payment_collection: ViewDef<PaymentCollectionRow>;
      report_meter_usage: ViewDef<MeterUsageRow>;
      report_maintenance: ViewDef<MaintenanceReportRow>;
      report_access_cards: ViewDef<AccessCardReportRow>;
      report_tenant_summary: ViewDef<TenantSummaryRow>;
      report_tenant_summary_by_segment: ViewDef<TenantSummaryBySegmentRow>;
    };
    Functions: {
      bangkok_today: { Args: Record<string, never>; Returns: string };
      next_invoice_number: { Args: { p_billing_month: string }; Returns: string };
      recalc_invoice: { Args: { p_invoice_id: string }; Returns: undefined };
      mark_overdue_invoices: { Args: Record<string, never>; Returns: number };
      process_due_move_out_notices: { Args: Record<string, never>; Returns: number };
      current_app_role: { Args: Record<string, never>; Returns: AppRole };
      due_soon_invoices_for_line: {
        Args: { p_days_ahead: number };
        Returns: {
          invoice_id: string;
          tenant_id: string;
          line_user_id: string;
          room_number: string;
          tenant_name: string;
          due_date: string;
          outstanding: number;
        }[];
      };
      expiring_contracts_for_line: {
        Args: { p_days_ahead: number };
        Returns: {
          contract_id: string;
          tenant_id: string;
          line_user_id: string;
          room_number: string;
          tenant_name: string;
          end_date: string;
        }[];
      };
      move_in_room: {
        Args: {
          p_room_id: string;
          p_full_name: string;
          p_phone: string;
          p_email: string | null;
          p_id_card_or_passport: string | null;
          p_nationality: string | null;
          p_emergency_contact: string | null;
          p_emergency_phone: string | null;
          p_start_date: string;
          p_end_date: string;
          p_monthly_rent: number;
          p_deposit: number;
          p_payment_due_day: number;
          p_occupant_count: number;
          p_activate_cards: boolean;
        };
        Returns: { contract_id: string; tenant_id: string }[];
      };
      move_out_room: {
        Args: {
          p_contract_id: string;
          p_terminated_at: string;
          p_termination_reason: string | null;
          p_return_cards: boolean;
        };
        Returns: undefined;
      };
      renew_contract: {
        Args: {
          p_contract_id: string;
          p_start_date: string;
          p_end_date: string;
          p_monthly_rent: number;
          p_deposit: number;
          p_payment_due_day: number;
          p_occupant_count: number;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      room_status: RoomStatus;
      room_type: RoomType;
      contract_status: ContractStatus;
      card_status: CardStatus;
      card_action: CardAction;
      meter_type: MeterType;
      invoice_status: InvoiceStatus;
      invoice_item_type: InvoiceItemType;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      maintenance_status: MaintenanceStatus;
      maintenance_priority: MaintenancePriority;
      audit_action: AuditAction;
      common_expense_category: CommonExpenseCategory;
    };
    CompositeTypes: Record<string, never>;
  };
};
