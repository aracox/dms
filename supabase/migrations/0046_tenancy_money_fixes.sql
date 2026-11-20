-- 0046_tenancy_money_fixes.sql
-- Medium-priority fixes from the end-to-end regression run (2026-11-20).
--
-- 1. Meter numbers at move-in and move-out. A room's first reading had no
--    starting point, so "previous reading" defaulted to 0 and one missed field
--    billed a tenant for every unit the meter had ever counted. Move-in now
--    records the meters' starting numbers and move-out their final ones; the
--    final numbers put the outgoing tenant's usage on their last bill.
-- 2. The deposit's receipt. Move-in records when (and how) the deposit was
--    paid. It is money held, not income: report_deposits_held totals it, and
--    no collection figure counts it.
-- 3. Card replacement fees are paid on the spot. A replacement that keeps the
--    card 'active' changed no status, so it was never logged and its fee left
--    no trace but the card's running total. The log now records it, and the
--    business overview counts the fee as income in the month it was paid.
-- 4. Repair costs count as expenses. "Net after expenses" counted shared
--    expenses only; a completed ticket's cost now lands in the month it was
--    completed.

-- 1, 2 ----------------------------------------------------------------------

alter table contracts
  add column meter_start_electricity numeric(12, 2) check (meter_start_electricity >= 0),
  add column meter_start_water numeric(12, 2) check (meter_start_water >= 0),
  add column meter_end_electricity numeric(12, 2) check (meter_end_electricity >= 0),
  add column meter_end_water numeric(12, 2) check (meter_end_water >= 0),
  add column deposit_received_on date,
  add column deposit_received_method payment_method
    check (deposit_received_method is null or deposit_received_method <> 'deposit');

comment on column contracts.meter_start_electricity is
  'Electricity meter number on move-in day: where this tenant''s usage starts.';
comment on column contracts.meter_end_electricity is
  'Electricity meter number on move-out day: billed on the tenant''s last bill.';
comment on column contracts.deposit_received_on is
  'When the deposit was paid. Null = not recorded as received. Held money, never income.';

-- The old overloads (0012, 0030) lacked the card fix of 0045 and would make
-- a call with the new arguments ambiguous.
drop function move_in_room(uuid, text, text, text, text, text, text, text, date, date, numeric, numeric, smallint, smallint, boolean);
drop function move_in_room(uuid, text, text, text, text, text, text, text, date, date, numeric, numeric, smallint, smallint, boolean, text);
drop function move_in_room(uuid, text, text, text, text, text, text, text, date, date, numeric, numeric, smallint, smallint, boolean, text, text);

create function move_in_room(
  p_room_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_id_card_or_passport text,
  p_nationality text,
  p_emergency_contact text,
  p_emergency_phone text,
  p_start_date date,
  p_end_date date,
  p_monthly_rent numeric,
  p_deposit numeric,
  p_payment_due_day smallint,
  p_occupant_count smallint,
  p_activate_cards boolean,
  p_line_id text default null,
  p_address text default null,
  p_meter_electricity numeric default null,
  p_meter_water numeric default null,
  p_deposit_received_on date default null,
  p_deposit_received_method payment_method default null
)
returns table (contract_id uuid, tenant_id uuid)
language plpgsql
as $$
declare
  v_room_is_test boolean;
  v_tenant_id uuid;
  v_contract_id uuid;
begin
  select is_test into v_room_is_test from rooms where id = p_room_id;
  if v_room_is_test is null then
    raise exception 'Room % not found', p_room_id using errcode = 'no_data_found';
  end if;

  insert into tenants (
    full_name, phone, email, id_card_or_passport, nationality,
    emergency_contact, emergency_phone, line_id, address, is_test
  )
  values (
    p_full_name, p_phone, p_email, p_id_card_or_passport, p_nationality,
    p_emergency_contact, p_emergency_phone, p_line_id, p_address, v_room_is_test
  )
  returning id into v_tenant_id;

  insert into contracts (
    room_id, tenant_id, start_date, end_date, monthly_rent, deposit,
    payment_due_day, occupant_count, status,
    meter_start_electricity, meter_start_water,
    deposit_received_on, deposit_received_method
  )
  values (
    p_room_id, v_tenant_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, 'active',
    p_meter_electricity, p_meter_water,
    p_deposit_received_on, p_deposit_received_method
  )
  returning id into v_contract_id;

  update rooms set status = 'occupied' where id = p_room_id;

  if p_activate_cards then
    update access_cards
    set status = 'active', issued_date = p_start_date, returned_date = null
    where room_id = p_room_id and status in ('available', 'returned');
  end if;

  return query select v_contract_id, v_tenant_id;
end;
$$;

-- The daily notice sweep (0032) calls this with four arguments; the meter
-- numbers default to null there, since nobody is at the meter.
drop function move_out_room(uuid, date, text, boolean);

create function move_out_room(
  p_contract_id uuid,
  p_terminated_at date,
  p_termination_reason text,
  p_return_cards boolean,
  p_meter_electricity numeric default null,
  p_meter_water numeric default null
)
returns void
language plpgsql
as $$
declare
  v_room_id uuid;
  v_status contract_status;
begin
  select room_id, status into v_room_id, v_status from contracts where id = p_contract_id;

  if v_room_id is null then
    raise exception 'Contract % not found', p_contract_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'Contract % is not active', p_contract_id using errcode = 'check_violation';
  end if;

  update contracts
  set status = 'terminated',
      terminated_at = p_terminated_at,
      termination_reason = p_termination_reason,
      meter_end_electricity = p_meter_electricity,
      meter_end_water = p_meter_water
  where id = p_contract_id;

  update rooms
  set status = case
    when exists (
      select 1 from room_reservations rr where rr.room_id = v_room_id and rr.status = 'held'
    ) then 'reserved'::room_status
    else 'vacant'::room_status
  end
  where id = v_room_id;

  if p_return_cards then
    update access_cards
    set status = 'returned', returned_date = p_terminated_at
    where room_id = v_room_id and status = 'active';
  end if;
end;
$$;

-- A renewal keeps the same deposit in hand, so its receipt carries over.
create or replace function renew_contract(
  p_contract_id uuid,
  p_start_date date,
  p_end_date date,
  p_monthly_rent numeric,
  p_deposit numeric,
  p_payment_due_day smallint,
  p_occupant_count smallint
)
returns uuid
language plpgsql
as $$
declare
  v_old contracts%rowtype;
  v_new_contract_id uuid;
begin
  select * into v_old from contracts where id = p_contract_id;

  if not found then
    raise exception 'Contract % not found', p_contract_id using errcode = 'no_data_found';
  end if;

  if v_old.status <> 'active' then
    raise exception 'Contract % is not active', p_contract_id using errcode = 'check_violation';
  end if;

  update contracts set status = 'expired' where id = p_contract_id;

  insert into contracts (
    room_id, tenant_id, start_date, end_date, monthly_rent, deposit,
    payment_due_day, occupant_count, status,
    deposit_received_on, deposit_received_method
  )
  values (
    v_old.room_id, v_old.tenant_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, 'active',
    v_old.deposit_received_on, v_old.deposit_received_method
  )
  returning id into v_new_contract_id;

  return v_new_contract_id;
end;
$$;

-- The month's reading never goes on the bill of a tenant who left with final
-- meter numbers: that bill already charges their usage up to move-out day,
-- and its unlinked utility line must not be adopted either.
create or replace function sync_meter_reading_to_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_status invoice_status;
begin
  select i.id, i.status into v_invoice_id, v_status
  from invoices i
  left join contracts c on c.id = i.contract_id
  where i.room_id = new.room_id
    and i.billing_month = new.billing_month
    and i.status <> 'cancelled'
    and not (
      c.terminated_at is not null
      and date_trunc('month', c.terminated_at)::date = new.billing_month
      and case new.meter_type
        when 'electricity' then c.meter_end_electricity is not null
        when 'water' then c.meter_end_water is not null
        else false
      end
    )
  order by
    exists (
      select 1 from invoice_items ii
      where ii.invoice_id = i.id and ii.meter_reading_id = new.id
    ) desc,
    c.start_date desc nulls last
  limit 1;

  if v_invoice_id is null or v_status not in ('draft', 'issued', 'overdue') then
    return new;
  end if;

  if new.usage > 0 then
    update invoice_items
    set quantity = new.usage,
        unit_price = new.rate
    where invoice_id = v_invoice_id
      and meter_reading_id = new.id;

    if not found then
      update invoice_items
      set quantity = new.usage,
          unit_price = new.rate,
          meter_reading_id = new.id
      where id = (
        select id from invoice_items
        where invoice_id = v_invoice_id
          and type = new.meter_type::text::invoice_item_type
          and meter_reading_id is null
        order by sort_order
        limit 1
      );
    end if;

    if not found then
      insert into invoice_items (
        invoice_id, type, description, quantity, unit_price, meter_reading_id, sort_order
      )
      values (
        v_invoice_id,
        new.meter_type::text::invoice_item_type,
        '',
        new.usage,
        new.rate,
        new.id,
        (select coalesce(max(sort_order), 0) + 1 from invoice_items where invoice_id = v_invoice_id)
      );
    end if;
  else
    delete from invoice_items
    where invoice_id = v_invoice_id
      and meter_reading_id = new.id;
  end if;

  return new;
end;
$$;

create view report_deposits_held with (security_invoker = on) as
select
  c.id                               as contract_id,
  c.room_id,
  r.room_number,
  room_property_segment(r.room_type) as property_segment,
  c.deposit,
  c.deposit_received_on,
  c.deposit_received_method
from contracts c
join rooms r on r.id = c.room_id
-- Active, or moved out and not yet settled. A renewed ('expired') contract
-- handed its deposit on to the one that replaced it.
where c.is_test = false
  and c.deposit_received_on is not null
  and c.deposit_settled_at is null
  and c.status in ('active', 'terminated');

comment on view report_deposits_held is
  'Deposits received and not yet settled: money held for tenants, not income.';

grant select on public.report_deposits_held to authenticated, service_role;

-- 3 -------------------------------------------------------------------------

-- Replacing a card that stays 'active' changes its fee (and usually its UID)
-- but not its status, so the log now also fires on those.
create or replace function log_access_card_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action card_action;
  v_fee numeric(12, 2);
begin
  v_fee := greatest(new.replacement_fee - old.replacement_fee, 0);

  if old.status is not distinct from new.status
    and v_fee = 0
    and old.card_uid is not distinct from new.card_uid then
    return null;
  end if;

  v_action := case
    when new.status = 'active' and (v_fee > 0 or old.card_uid is distinct from new.card_uid)
      then 'replace'::card_action
    when new.status = 'active' then 'activate'::card_action
    when new.status = 'disabled' then 'disable'::card_action
    when new.status = 'lost' then 'report_lost'::card_action
    when new.status = 'returned' then 'return'::card_action
    when new.status = 'damaged' then 'mark_damaged'::card_action
    when new.status = 'available' then 'issue'::card_action
  end;

  insert into access_card_events (card_id, action, from_status, to_status, fee, note, actor_id)
  values (new.id, v_action, old.status, new.status, v_fee, new.notes, auth.uid());

  return null;
end;
$$;

drop trigger access_cards_log_events on access_cards;

create trigger access_cards_log_events
  after update of status, replacement_fee, card_uid on access_cards
  for each row execute function log_access_card_event();

-- 3, 4: the overview ----------------------------------------------------------
-- Same as 0039 except: expense_amount adds completed repairs, the new
-- other_income (card fees, by the Bangkok month they were paid) counts toward
-- net_after_expenses, and both parts are appended as columns.

create or replace view report_business_overview with (security_invoker = on) as
with bounds as (
  select
    least(
      (select min(billing_month) from invoices where is_test = false),
      (select min(coalesce(billing_month, date_trunc('month', expense_date)::date))
       from common_expenses where is_test = false),
      date_trunc('month', bangkok_today())::date
    ) as first_month,
    greatest(
      (select max(billing_month) from invoices where is_test = false),
      (select max(coalesce(billing_month, date_trunc('month', expense_date)::date))
       from common_expenses where is_test = false),
      date_trunc('month', bangkok_today())::date
    ) as last_month
),
months as (
  select month_start::date as billing_month
  from bounds b
  cross join lateral generate_series(
    b.first_month,
    b.last_month,
    interval '1 month'
  ) as month_start
),
room_count as (
  select count(*)::numeric as total_rooms
  from rooms
  where is_test = false
),
occupancy as (
  select
    m.billing_month,
    count(distinct c.room_id) as occupied_rooms
  from months m
  left join contracts c
    on c.is_test = false
   and c.status <> 'draft'
   and c.start_date <= (m.billing_month + interval '1 month - 1 day')::date
   and coalesce(c.terminated_at, c.end_date) >= m.billing_month
  group by m.billing_month
),
billing as (
  select
    i.billing_month,
    coalesce(sum(i.total), 0) as billed_amount
  from invoices i
  where i.is_test = false
    and i.status <> 'cancelled'
  group by i.billing_month
),
collections as (
  select
    i.billing_month,
    coalesce(sum(p.amount), 0) as collected_amount
  from invoices i
  join payments p on p.invoice_id = i.id
  where i.is_test = false
    and p.is_test = false
    and i.status <> 'cancelled'
    and p.status = 'confirmed'
  group by i.billing_month
),
expenses as (
  select
    coalesce(ce.billing_month, date_trunc('month', ce.expense_date)::date) as billing_month,
    coalesce(sum(ce.amount), 0) as expense_amount
  from common_expenses ce
  where ce.is_test = false
  group by 1
),
repairs as (
  select
    date_trunc('month', (mt.completed_at at time zone 'Asia/Bangkok'))::date as billing_month,
    coalesce(sum(mt.cost), 0) as repair_amount
  from maintenance_tickets mt
  where mt.is_test = false
    and mt.status = 'completed'
    and mt.cost is not null
  group by 1
),
card_fees as (
  select
    date_trunc('month', (e.created_at at time zone 'Asia/Bangkok'))::date as billing_month,
    coalesce(sum(e.fee), 0) as fee_amount
  from access_card_events e
  join access_cards ac on ac.id = e.card_id
  where ac.is_test = false
    and e.fee > 0
  group by 1
)
select
  m.billing_month,
  o.occupied_rooms,
  rc.total_rooms::bigint as total_rooms,
  case
    when rc.total_rooms = 0 then 0
    else round(o.occupied_rooms::numeric * 100 / rc.total_rooms, 1)
  end as occupancy_rate,
  coalesce(b.billed_amount, 0) as billed_amount,
  coalesce(c.collected_amount, 0) as collected_amount,
  coalesce(e.expense_amount, 0) + coalesce(rp.repair_amount, 0) as expense_amount,
  coalesce(c.collected_amount, 0) + coalesce(cf.fee_amount, 0)
    - coalesce(e.expense_amount, 0) - coalesce(rp.repair_amount, 0) as net_after_expenses,
  case
    when coalesce(b.billed_amount, 0) = 0 then 0
    else round(coalesce(c.collected_amount, 0) * 100 / b.billed_amount, 1)
  end as collection_rate,
  coalesce(rp.repair_amount, 0) as repair_amount,
  coalesce(cf.fee_amount, 0) as other_income
from months m
cross join room_count rc
join occupancy o on o.billing_month = m.billing_month
left join billing b on b.billing_month = m.billing_month
left join collections c on c.billing_month = m.billing_month
left join expenses e on e.billing_month = m.billing_month
left join repairs rp on rp.billing_month = m.billing_month
left join card_fees cf on cf.billing_month = m.billing_month
order by m.billing_month;

notify pgrst, 'reload schema';
