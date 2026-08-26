-- 0007_rls.sql
--
-- Row Level Security on every application table.
--
-- Role model:
--   staff  -- read everything; may record meter readings, maintenance tickets
--            and payments. No deletes, no settings, no contract/room/card edits.
--   admin  -- full operational read/write. No deletes of financial records.
--   owner  -- everything, including deletes and settings.
--
-- The anon role gets nothing: every policy requires a profile row, which only
-- exists for authenticated users.

-- ---------------------------------------------------------------------------
-- Grants. RLS decides which ROWS; grants decide whether the role can speak to
-- the table at all. Both are required.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
alter table profiles              enable row level security;
alter table settings              enable row level security;
alter table rooms                 enable row level security;
alter table tenants               enable row level security;
alter table contracts             enable row level security;
alter table access_cards          enable row level security;
alter table access_card_events    enable row level security;
alter table meter_readings        enable row level security;
alter table invoices              enable row level security;
alter table invoice_items         enable row level security;
alter table payments              enable row level security;
alter table maintenance_tickets   enable row level security;
alter table audit_logs            enable row level security;

-- ===========================================================================
-- profiles
-- current_app_role() is SECURITY DEFINER, so these policies do not recurse.
-- ===========================================================================
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin_or_owner());

create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_owner_all on profiles for all to authenticated
  using (is_owner()) with check (is_owner());

-- ===========================================================================
-- settings -- readable by all staff, writable by the owner only
-- ===========================================================================
create policy settings_select on settings for select to authenticated
  using (is_staff_or_above());

create policy settings_owner_write on settings for all to authenticated
  using (is_owner()) with check (is_owner());

-- ===========================================================================
-- rooms
-- ===========================================================================
create policy rooms_select on rooms for select to authenticated
  using (is_staff_or_above());

create policy rooms_write on rooms for insert to authenticated
  with check (is_admin_or_owner());

create policy rooms_update on rooms for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy rooms_delete on rooms for delete to authenticated
  using (is_owner());

-- ===========================================================================
-- tenants
-- ===========================================================================
create policy tenants_select on tenants for select to authenticated
  using (is_staff_or_above());

create policy tenants_insert on tenants for insert to authenticated
  with check (is_admin_or_owner());

create policy tenants_update on tenants for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy tenants_delete on tenants for delete to authenticated
  using (is_owner());

-- ===========================================================================
-- contracts
-- ===========================================================================
create policy contracts_select on contracts for select to authenticated
  using (is_staff_or_above());

create policy contracts_insert on contracts for insert to authenticated
  with check (is_admin_or_owner());

create policy contracts_update on contracts for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy contracts_delete on contracts for delete to authenticated
  using (is_owner());

-- ===========================================================================
-- access_cards + history
-- ===========================================================================
create policy access_cards_select on access_cards for select to authenticated
  using (is_staff_or_above());

create policy access_cards_insert on access_cards for insert to authenticated
  with check (is_admin_or_owner());

create policy access_cards_update on access_cards for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy access_cards_delete on access_cards for delete to authenticated
  using (is_owner());

-- Append-only: readable by staff, written only by the log_access_card_event
-- trigger (SECURITY DEFINER). No update or delete policy exists, for anyone.
create policy access_card_events_select on access_card_events for select to authenticated
  using (is_staff_or_above());

-- ===========================================================================
-- meter_readings -- staff may record; corrections are admin+
-- ===========================================================================
create policy meter_readings_select on meter_readings for select to authenticated
  using (is_staff_or_above());

create policy meter_readings_insert on meter_readings for insert to authenticated
  with check (is_staff_or_above());

create policy meter_readings_update on meter_readings for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy meter_readings_delete on meter_readings for delete to authenticated
  using (is_owner());

-- ===========================================================================
-- invoices + items
-- ===========================================================================
create policy invoices_select on invoices for select to authenticated
  using (is_staff_or_above());

create policy invoices_insert on invoices for insert to authenticated
  with check (is_admin_or_owner());

create policy invoices_update on invoices for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy invoices_delete on invoices for delete to authenticated
  using (is_owner());

create policy invoice_items_select on invoice_items for select to authenticated
  using (is_staff_or_above());

create policy invoice_items_insert on invoice_items for insert to authenticated
  with check (is_admin_or_owner());

create policy invoice_items_update on invoice_items for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy invoice_items_delete on invoice_items for delete to authenticated
  using (is_admin_or_owner());

-- ===========================================================================
-- payments -- staff may record a payment; only the owner may delete one
-- ===========================================================================
create policy payments_select on payments for select to authenticated
  using (is_staff_or_above());

create policy payments_insert on payments for insert to authenticated
  with check (is_staff_or_above());

create policy payments_update on payments for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy payments_delete on payments for delete to authenticated
  using (is_owner());

-- ===========================================================================
-- maintenance_tickets -- staff may open and progress tickets
-- ===========================================================================
create policy maintenance_select on maintenance_tickets for select to authenticated
  using (is_staff_or_above());

create policy maintenance_insert on maintenance_tickets for insert to authenticated
  with check (is_staff_or_above());

create policy maintenance_update on maintenance_tickets for update to authenticated
  using (is_staff_or_above()) with check (is_staff_or_above());

create policy maintenance_delete on maintenance_tickets for delete to authenticated
  using (is_admin_or_owner());

-- ===========================================================================
-- audit_logs -- append-only, admin+ readable
-- ===========================================================================
create policy audit_logs_select on audit_logs for select to authenticated
  using (is_admin_or_owner());

create policy audit_logs_insert on audit_logs for insert to authenticated
  with check (is_staff_or_above());
