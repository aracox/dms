-- Fresh Supabase projects no longer grant Data API access automatically.
-- Migration 0007 covered authenticated access only to objects existing then.
-- Keep grants explicit; row-level policies continue to control each operation.

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.profiles,
  public.settings,
  public.rooms,
  public.tenants,
  public.contracts,
  public.access_cards,
  public.access_card_events,
  public.meter_readings,
  public.invoices,
  public.invoice_items,
  public.payments,
  public.maintenance_tickets,
  public.audit_logs,
  public.settings_history,
  public.tenant_documents,
  public.common_expenses,
  public.segment_settings,
  public.segment_settings_history,
  public.contract_subscriptions,
  public.line_reminders_sent,
  public.room_reservations
to service_role;

grant usage, select on sequence public.invoice_number_seq to service_role;

grant select on public.settings_history, public.line_reminders_sent to authenticated;
grant select, insert, delete on public.tenant_documents, public.contract_subscriptions
  to authenticated;
grant select, insert, update, delete on public.common_expenses, public.room_reservations
  to authenticated;

grant select on
  public.v_room_board,
  public.report_rooms,
  public.report_room_summary,
  public.report_room_summary_by_segment,
  public.report_finance_summary,
  public.report_finance_summary_by_segment,
  public.report_tenant_summary,
  public.report_tenant_summary_by_segment,
  public.report_contracts_expiring,
  public.report_outstanding,
  public.report_maintenance,
  public.report_access_cards,
  public.report_meter_usage,
  public.report_payment_collection,
  public.report_business_overview,
  public.report_business_overview_by_segment,
  public.report_move_out_notices,
  public.report_expense_months
to authenticated, service_role;

-- Migration tracking belongs to the Postgres migration connection only.
revoke all on public.schema_migrations from anon, authenticated, service_role;

notify pgrst, 'reload schema';
