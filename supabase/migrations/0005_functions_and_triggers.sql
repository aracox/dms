-- 0005_functions_and_triggers.sql
-- Server-side business rules. Everything here exists so that a bug, a stray
-- client call, or a hand-written SQL statement still cannot corrupt the invariants.

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- Business "today" in Thailand. Vercel runs UTC; using now()::date directly
-- would put late-evening Bangkok activity on the previous day.
create or replace function bangkok_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Bangkok')::date;
$$;

comment on function bangkok_today is 'Current calendar date in Asia/Bangkok, not the server timezone.';

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Role of the calling user. SECURITY DEFINER so RLS policies on profiles do not
-- recurse when a policy on another table asks for the role.
create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function is_owner()
returns boolean
language sql
stable
as $$
  select current_app_role() = 'owner';
$$;

create or replace function is_admin_or_owner()
returns boolean
language sql
stable
as $$
  select current_app_role() in ('owner', 'admin');
$$;

create or replace function is_staff_or_above()
returns boolean
language sql
stable
as $$
  select current_app_role() in ('owner', 'admin', 'staff');
$$;

-- ===========================================================================
-- Profile provisioning
-- ===========================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ===========================================================================
-- Test-data containment (CLAUDE.md rule 1)
--
-- is_test is never trusted from the client. It is forced to match the parent
-- room (or parent invoice) on every write, so a test row can never be filed
-- against a real room and leak into reporting.
-- ===========================================================================

create or replace function inherit_is_test_from_room()
returns trigger
language plpgsql
as $$
declare
  v_is_test boolean;
begin
  -- Common-area maintenance tickets have no room; keep whatever was supplied.
  if new.room_id is null then
    return new;
  end if;

  select is_test into v_is_test from rooms where id = new.room_id;

  if v_is_test is null then
    raise exception 'Room % does not exist', new.room_id using errcode = 'foreign_key_violation';
  end if;

  new.is_test := v_is_test;
  return new;
end;
$$;

create or replace function inherit_is_test_from_invoice()
returns trigger
language plpgsql
as $$
declare
  v_is_test boolean;
begin
  select is_test into v_is_test from invoices where id = new.invoice_id;

  if v_is_test is null then
    raise exception 'Invoice % does not exist', new.invoice_id using errcode = 'foreign_key_violation';
  end if;

  new.is_test := v_is_test;
  return new;
end;
$$;

create trigger contracts_inherit_is_test
  before insert or update of room_id on contracts
  for each row execute function inherit_is_test_from_room();

create trigger access_cards_inherit_is_test
  before insert or update of room_id on access_cards
  for each row execute function inherit_is_test_from_room();

create trigger meter_readings_inherit_is_test
  before insert or update of room_id on meter_readings
  for each row execute function inherit_is_test_from_room();

create trigger invoices_inherit_is_test
  before insert or update of room_id on invoices
  for each row execute function inherit_is_test_from_room();

create trigger maintenance_inherit_is_test
  before insert or update of room_id on maintenance_tickets
  for each row execute function inherit_is_test_from_room();

create trigger payments_inherit_is_test
  before insert or update of invoice_id on payments
  for each row execute function inherit_is_test_from_invoice();

-- A test tenant must not be attached to a real room, or vice versa.
create or replace function enforce_contract_tenant_test_match()
returns trigger
language plpgsql
as $$
declare
  v_room_is_test boolean;
  v_tenant_is_test boolean;
begin
  select is_test into v_room_is_test from rooms where id = new.room_id;
  select is_test into v_tenant_is_test from tenants where id = new.tenant_id;

  if v_room_is_test is distinct from v_tenant_is_test then
    raise exception
      'Cannot contract a % tenant to a % room',
      case when v_tenant_is_test then 'test' else 'real' end,
      case when v_room_is_test then 'test' else 'real' end
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger contracts_tenant_test_match
  before insert or update of room_id, tenant_id on contracts
  for each row execute function enforce_contract_tenant_test_match();

-- ===========================================================================
-- Access cards: exactly two per room, named <room_number>-A / -B
-- ===========================================================================

create or replace function enforce_room_card_rules()
returns trigger
language plpgsql
as $$
declare
  v_room_number text;
  v_existing integer;
begin
  select room_number into v_room_number from rooms where id = new.room_id;

  if v_room_number is null then
    raise exception 'Room % does not exist', new.room_id using errcode = 'foreign_key_violation';
  end if;

  if new.card_number not in (v_room_number || '-A', v_room_number || '-B') then
    raise exception
      'Access card must be named %-A or %-B, got %',
      v_room_number, v_room_number, new.card_number
      using errcode = 'check_violation';
  end if;

  select count(*) into v_existing
  from access_cards
  where room_id = new.room_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_existing >= 2 then
    raise exception
      'Room % already has 2 access cards. Cards belong to the room, not to occupants.',
      v_room_number
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger access_cards_room_rules
  before insert or update of room_id, card_number on access_cards
  for each row execute function enforce_room_card_rules();

-- The trigger is the SOLE writer of access_card_events, so no status change can
-- escape the audit trail. Application code updates access_cards.status only.
-- SECURITY DEFINER: an audit write must never be refused because of the caller's
-- role, and access_card_events is append-only for everyone.
create or replace function log_access_card_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action card_action;
begin
  if old.status is not distinct from new.status then
    return null;
  end if;

  v_action := case new.status
    when 'active' then 'activate'::card_action
    when 'disabled' then 'disable'::card_action
    when 'lost' then 'report_lost'::card_action
    when 'returned' then 'return'::card_action
    when 'damaged' then 'mark_damaged'::card_action
    when 'available' then 'issue'::card_action
  end;

  insert into access_card_events (card_id, action, from_status, to_status, fee, note, actor_id)
  values (
    new.id,
    v_action,
    old.status,
    new.status,
    case when new.replacement_fee > old.replacement_fee
      then new.replacement_fee - old.replacement_fee
      else 0
    end,
    new.notes,
    auth.uid()
  );

  return null;
end;
$$;

create trigger access_cards_log_events
  after update of status on access_cards
  for each row execute function log_access_card_event();

-- ===========================================================================
-- Invoicing: totals and status are derived, never client-supplied
-- ===========================================================================

create sequence invoice_number_seq;

-- Human-readable and globally unique. Not gap-free per month, which is fine --
-- it is a reference, not a statutory accounting sequence.
create or replace function next_invoice_number(p_billing_month date)
returns text
language sql
volatile
as $$
  select 'INV-'
    || to_char(p_billing_month, 'YYYYMM')
    || '-'
    || lpad(nextval('invoice_number_seq')::text, 5, '0');
$$;

-- SECURITY DEFINER: staff may record a payment without holding UPDATE on invoices.
-- This is the only sanctioned writer of invoice totals and status.
create or replace function recalc_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12, 2);
  v_discount numeric(12, 2);
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_status invoice_status;
  v_due_date date;
begin
  select
    coalesce(sum(amount) filter (where type <> 'discount'), 0),
    coalesce(sum(amount) filter (where type = 'discount'), 0)
  into v_subtotal, v_discount
  from invoice_items
  where invoice_id = p_invoice_id;

  if v_discount > v_subtotal then
    raise exception
      'Discount % exceeds subtotal % on invoice %', v_discount, v_subtotal, p_invoice_id
      using errcode = 'check_violation';
  end if;

  v_total := v_subtotal - v_discount;

  select coalesce(sum(amount), 0)
  into v_paid
  from payments
  where invoice_id = p_invoice_id
    and status = 'confirmed';

  if v_paid > v_total then
    raise exception
      'Confirmed payments % exceed invoice total % on invoice %', v_paid, v_total, p_invoice_id
      using errcode = 'check_violation';
  end if;

  select status, due_date into v_status, v_due_date from invoices where id = p_invoice_id;

  if v_status is null then
    return; -- invoice was deleted in this transaction
  end if;

  -- draft and cancelled invoices keep their status; only totals are refreshed.
  if v_status not in ('draft', 'cancelled') then
    if v_total > 0 and v_paid >= v_total then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partially_paid';
    elsif v_due_date < bangkok_today() then
      v_status := 'overdue';
    else
      v_status := 'issued';
    end if;
  end if;

  update invoices
  set subtotal = v_subtotal,
      discount = v_discount,
      total = v_total,
      status = v_status,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

comment on function recalc_invoice is
  'Recomputes invoice subtotal/discount/total from items and status from confirmed payments. '
  'Raises if payments would exceed the total. Single source of truth for invoice money.';

create or replace function trg_recalc_invoice_from_items()
returns trigger
language plpgsql
as $$
begin
  perform recalc_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;

create trigger invoice_items_recalc
  after insert or update or delete on invoice_items
  for each row execute function trg_recalc_invoice_from_items();

create or replace function trg_recalc_invoice_from_payments()
returns trigger
language plpgsql
as $$
begin
  perform recalc_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;

create trigger payments_recalc
  after insert or update or delete on payments
  for each row execute function trg_recalc_invoice_from_payments();

-- Sweep issued invoices past their due date. Call from a scheduled job or on
-- dashboard load; it only ever moves 'issued' -> 'overdue'.
create or replace function mark_overdue_invoices()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update invoices
  set status = 'overdue', updated_at = now()
  where status = 'issued'
    and due_date < bangkok_today();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ===========================================================================
-- Audit trail
-- ===========================================================================

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (user_id, entity_type, entity_id, action, old_value, new_value)
  values (
    auth.uid(),
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    lower(tg_op)::audit_action,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return null;
end;
$$;

create trigger contracts_audit
  after insert or update or delete on contracts
  for each row execute function audit_row_change();

create trigger invoices_audit
  after insert or update or delete on invoices
  for each row execute function audit_row_change();

create trigger payments_audit
  after insert or update or delete on payments
  for each row execute function audit_row_change();

create trigger access_cards_audit
  after insert or update or delete on access_cards
  for each row execute function audit_row_change();

create trigger meter_readings_audit
  after insert or update or delete on meter_readings
  for each row execute function audit_row_change();

-- ===========================================================================
-- updated_at
-- ===========================================================================

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger rooms_set_updated_at before update on rooms
  for each row execute function set_updated_at();
create trigger tenants_set_updated_at before update on tenants
  for each row execute function set_updated_at();
create trigger contracts_set_updated_at before update on contracts
  for each row execute function set_updated_at();
create trigger access_cards_set_updated_at before update on access_cards
  for each row execute function set_updated_at();
create trigger meter_readings_set_updated_at before update on meter_readings
  for each row execute function set_updated_at();
create trigger invoices_set_updated_at before update on invoices
  for each row execute function set_updated_at();
create trigger payments_set_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger maintenance_set_updated_at before update on maintenance_tickets
  for each row execute function set_updated_at();
