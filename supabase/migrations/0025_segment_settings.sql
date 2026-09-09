-- 0025_segment_settings.sql
-- Rates, fees and defaults split per property segment.
--
-- The owner runs หอพัก and บ้านพัก as two businesses, and they do not charge
-- the same electricity rate, deposit or grace period. Every setting except the
-- property's own identity and display currency now carries one value per
-- segment, and BOTH values are required -- there is no shared fallback, so a
-- segment can never quietly inherit the other's price.
--
-- Shape: segment_settings OVERRIDES nothing. It is authoritative for every
-- segment-scoped key, and settings.value for those keys is frozen. A nullable
-- `segment` column on settings was the alternative, but NULL does not compare
-- equal in a primary key, so "the shared row" would have needed a sentinel and
-- every existing read would have had to learn about it. A second table keeps
-- settings, settings_history and its trigger working exactly as before.

-- ---------------------------------------------------------------------------
-- Which keys are segment-scoped.
--
-- Marked on settings itself rather than listed in a CHECK, so adding a setting
-- later is an insert and not a migration to edit this list.
-- ---------------------------------------------------------------------------
alter table settings add column is_segment_scoped boolean not null default true;

-- Identity and currency describe the property as a whole. Everything else --
-- utility rates, optional fees, move-in defaults, due day, grace days, late
-- fee -- differs per segment.
update settings set is_segment_scoped = false where key in ('currency', 'dormitory');

comment on column settings.is_segment_scoped is
  'True when the value lives in segment_settings per segment, and settings.value is frozen. False for whole-property settings (currency, dormitory).';

create table segment_settings (
  key text not null references settings (key) on delete restrict,
  segment property_segment not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (key, segment)
);

comment on table segment_settings is
  'One value per (segment-scoped setting, segment). Authoritative: billing reads this, never settings.value. Both segments are always present -- see segment_settings_require_scoped and the absence of a delete policy.';

-- A row here only makes sense for a key that is actually segment-scoped.
create function segment_settings_require_scoped()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from settings
    where key = new.key and is_segment_scoped
  ) then
    raise exception 'setting % is whole-property and cannot have a per-segment value', new.key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger segment_settings_scoped_only
  before insert or update on segment_settings
  for each row execute function segment_settings_require_scoped();

-- ---------------------------------------------------------------------------
-- Backfill: every segment-scoped key gets both segments, seeded from the value
-- the whole property was using, so nothing changes price on the day this runs.
-- ---------------------------------------------------------------------------
insert into segment_settings (key, segment, value)
select s.key, seg.segment, s.value
from settings s
cross join (
  select unnest(enum_range(null::property_segment)) as segment
) seg
where s.is_segment_scoped;

-- ---------------------------------------------------------------------------
-- settings.value is frozen for segment-scoped keys, so there is exactly one
-- source of truth for a price. Without this, an UPDATE on settings would look
-- like it worked and change nothing.
-- ---------------------------------------------------------------------------
create function settings_reject_scoped_value_write()
returns trigger
language plpgsql
as $$
begin
  if new.is_segment_scoped and new.value is distinct from old.value then
    raise exception
      'setting % is per segment -- update segment_settings instead', new.key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger settings_scoped_value_frozen
  before update on settings
  for each row execute function settings_reject_scoped_value_write();

-- A newly added segment-scoped setting gets both segment rows automatically,
-- seeded from the value it was inserted with. Keeps "both segments always
-- present" true without every caller remembering it.
create function settings_seed_segment_values()
returns trigger
language plpgsql
as $$
begin
  if new.is_segment_scoped then
    insert into segment_settings (key, segment, value)
    select new.key, seg.segment, new.value
    from (select unnest(enum_range(null::property_segment)) as segment) seg
    on conflict (key, segment) do nothing;
  end if;
  return new;
end;
$$;

create trigger settings_seed_segments
  after insert on settings
  for each row execute function settings_seed_segment_values();

create trigger segment_settings_set_updated_at before update on segment_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit trail, mirroring settings_history (0010). Reference only: billing math
-- snapshots a rate onto meter_readings.rate / invoice_items.unit_price when it
-- is used, so past months stay correct without reading this.
-- ---------------------------------------------------------------------------
create table segment_settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  segment property_segment not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table segment_settings_history is
  'Append-only log of segment_settings changes, written by a trigger. Audit/reference only.';

create index segment_settings_history_key_idx
  on segment_settings_history (key, segment, changed_at desc);

create function log_segment_settings_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into segment_settings_history (key, segment, old_value, new_value, changed_by)
  values (new.key, new.segment, old.value, new.value, new.updated_by);
  return new;
end;
$$;

create trigger on_segment_settings_value_changed
  after update on segment_settings
  for each row
  when (old.value is distinct from new.value)
  execute function log_segment_settings_history();

-- ---------------------------------------------------------------------------
-- RLS, matching settings (0007): staff read, owner writes. No delete policy on
-- segment_settings, which is what keeps both segments present -- a value can be
-- changed but never removed.
-- ---------------------------------------------------------------------------
-- No delete grant, and no delete policy below either: a value may be changed
-- but never removed, which is what keeps both segments always present.
grant select, insert, update on segment_settings to authenticated;
grant select on segment_settings_history to authenticated;

alter table segment_settings enable row level security;
alter table segment_settings_history enable row level security;

create policy segment_settings_select on segment_settings for select to authenticated
  using (is_staff_or_above());

create policy segment_settings_owner_insert on segment_settings for insert to authenticated
  with check (is_owner());

create policy segment_settings_owner_update on segment_settings for update to authenticated
  using (is_owner()) with check (is_owner());

create policy segment_settings_history_select on segment_settings_history for select to authenticated
  using (is_staff_or_above());

-- ===========================================================================
-- Lookups. Every one raises rather than defaulting: a missing row means the
-- schema drifted, and billing 0 THB silently is far worse than failing.
-- ===========================================================================
create function segment_setting_numeric(p_key text, p_segment property_segment)
returns numeric
language plpgsql
stable
as $$
declare
  v_value jsonb;
begin
  select value into v_value
  from segment_settings
  where key = p_key and segment = p_segment;

  if v_value is null then
    raise exception 'segment_settings has no value for % / %', p_key, p_segment
      using errcode = 'no_data_found';
  end if;

  return v_value::text::numeric;
end;
$$;

comment on function segment_setting_numeric is
  'One segment''s numeric setting. Raises when absent -- there is no shared fallback by design.';

create or replace function payment_grace_days(p_segment property_segment)
returns integer
language sql
stable
as $$
  select segment_setting_numeric('payment_grace_days', p_segment)::integer;
$$;

comment on function payment_grace_days(property_segment) is
  'Days past due_date before one segment''s invoice counts as overdue.';

create or replace function default_monthly_rent(p_segment property_segment)
returns numeric(12, 2)
language sql
stable
as $$
  select segment_setting_numeric('default_monthly_rent', p_segment)::numeric(12, 2);
$$;

create or replace function default_deposit(p_segment property_segment)
returns numeric(12, 2)
language sql
stable
as $$
  select segment_setting_numeric('default_deposit', p_segment)::numeric(12, 2);
$$;

-- The no-argument forms are kept as raising stubs rather than dropped, so any
-- caller this migration missed fails with an instruction instead of reading a
-- frozen settings.value and billing the wrong segment's price.
create or replace function payment_grace_days()
returns integer
language plpgsql
stable
as $$
begin
  raise exception
    'payment_grace_days() is per segment since 0025 -- call payment_grace_days(property_segment)'
    using errcode = 'feature_not_supported';
end;
$$;

create or replace function default_monthly_rent()
returns numeric(12, 2)
language plpgsql
stable
as $$
begin
  raise exception
    'default_monthly_rent() is per segment since 0025 -- call default_monthly_rent(property_segment)'
    using errcode = 'feature_not_supported';
end;
$$;

create or replace function default_deposit()
returns numeric(12, 2)
language plpgsql
stable
as $$
begin
  raise exception
    'default_deposit() is per segment since 0025 -- call default_deposit(property_segment)'
    using errcode = 'feature_not_supported';
end;
$$;

-- ===========================================================================
-- Every caller of the three functions above, repointed at the segment form.
-- Bodies are otherwise identical to 0015 / 0019.
-- ===========================================================================

-- v_room_board: same column list as 0019, so report_rooms (which selects v.*)
-- is unaffected. r.room_type is already in scope for the segment.
create or replace view v_room_board with (security_invoker = on) as
select
  r.id                                   as room_id,
  r.room_number,
  r.floor,
  r.room_type,
  r.status                               as room_status,
  coalesce(
    c.monthly_rent,
    default_monthly_rent(room_property_segment(r.room_type))
  )::numeric(12, 2) as monthly_rent,
  coalesce(
    c.deposit,
    default_deposit(room_property_segment(r.room_type))
  )::numeric(12, 2) as deposit,
  r.is_test,

  c.id                                   as contract_id,
  c.status                               as contract_status,
  c.start_date,
  c.end_date,
  c.occupant_count,
  c.payment_due_day,

  t.id                                   as tenant_id,
  t.full_name                            as tenant_name,
  t.phone                                as tenant_phone,

  inv.id                                 as invoice_id,
  inv.invoice_number,
  inv.billing_month,
  inv.due_date,
  inv.status                             as invoice_status,
  coalesce(inv.total, 0)                 as invoice_total,
  coalesce(pay.paid_amount, 0)           as paid_amount,
  coalesce(inv.total, 0) - coalesce(pay.paid_amount, 0) as outstanding,

  case
    when inv.id is null then 'none'
    when inv.status = 'paid' then 'paid'
    when inv.status = 'cancelled' then 'none'
    when inv.status = 'draft' then 'none'
    when inv.due_date + payment_grace_days(room_property_segment(r.room_type))
      < bangkok_today() then 'overdue'
    else 'payment_due'
  end                                    as financial_status,

  coalesce(mt.open_count, 0)             as open_maintenance_count,
  coalesce(cards.lost_count, 0)          as lost_card_count,
  coalesce(cards.active_count, 0)        as active_card_count,
  coalesce(cards.total_count, 0)         as total_card_count

from rooms r

left join lateral (
  select ct.*
  from contracts ct
  where ct.room_id = r.id and ct.status = 'active'
  order by ct.start_date desc
  limit 1
) c on true

left join tenants t on t.id = c.tenant_id

left join lateral (
  select i.*
  from invoices i
  where i.room_id = r.id and i.status <> 'cancelled'
  order by i.billing_month desc, i.created_at desc
  limit 1
) inv on true

left join lateral (
  select coalesce(sum(p.amount), 0) as paid_amount
  from payments p
  where p.invoice_id = inv.id and p.status = 'confirmed'
) pay on true

left join lateral (
  select count(*) as open_count
  from maintenance_tickets m
  where m.room_id = r.id and m.status in ('open', 'in_progress', 'waiting')
) mt on true

left join lateral (
  select
    count(*)                                  as total_count,
    count(*) filter (where ac.status = 'lost')   as lost_count,
    count(*) filter (where ac.status = 'active') as active_count
  from access_cards ac
  where ac.room_id = r.id
) cards on true;

comment on view v_room_board is
  'Room board for floor plan / room list / test mode. Includes test rooms -- filter on is_test.';

-- recalc_invoice: same body as 0015, but the overdue branch reads the grace
-- period of the segment this invoice's room belongs to.
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
  v_segment property_segment;
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

  select room_property_segment(r.room_type)
  into v_segment
  from invoices i
  join rooms r on r.id = i.room_id
  where i.id = p_invoice_id;

  -- draft and cancelled invoices keep their status; only totals are refreshed.
  if v_status not in ('draft', 'cancelled') then
    if v_total > 0 and v_paid >= v_total then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partially_paid';
    elsif v_due_date + payment_grace_days(v_segment) < bangkok_today() then
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

-- mark_overdue_invoices: each invoice is compared against its own segment's
-- grace period, so a house invoice is not aged by the dorm's setting.
create or replace function mark_overdue_invoices()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update invoices i
  set status = 'overdue', updated_at = now()
  from rooms r
  where r.id = i.room_id
    and i.status = 'issued'
    and i.due_date + payment_grace_days(room_property_segment(r.room_type))
      < bangkok_today();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- report_finance_summary: same columns as 0015. The balances CTE gains a rooms
-- join, which it did not need before, purely to reach the segment.
create or replace view report_finance_summary with (security_invoker = on) as
with month as (
  select date_trunc('month', bangkok_today())::date as billing_month
),
-- Rent the building should bill this month, from active contracts.
expected as (
  select coalesce(sum(c.monthly_rent), 0) as expected_rent
  from contracts c
  join rooms r on r.id = c.room_id
  where c.status = 'active' and r.is_test = false
),
-- What has actually been invoiced for the current month.
invoiced as (
  select coalesce(sum(i.total), 0) as invoiced_total
  from invoices i, month m
  where i.is_test = false
    and i.billing_month = m.billing_month
    and i.status <> 'cancelled'
),
collected as (
  select coalesce(sum(p.amount), 0) as collected_this_month
  from payments p, month m
  where p.is_test = false
    and p.status = 'confirmed'
    and date_trunc('month', p.payment_date)::date = m.billing_month
),
-- Outstanding and overdue span all months, not just the current one.
balances as (
  select
    coalesce(sum(i.total - coalesce(paid.amount, 0)), 0) as outstanding,
    coalesce(sum(
      case when i.due_date + payment_grace_days(room_property_segment(r.room_type))
        < bangkok_today()
        then i.total - coalesce(paid.amount, 0)
        else 0
      end
    ), 0) as overdue
  from invoices i
  join rooms r on r.id = i.room_id
  left join lateral (
    select coalesce(sum(p.amount), 0) as amount
    from payments p
    where p.invoice_id = i.id and p.status = 'confirmed'
  ) paid on true
  where i.is_test = false
    and i.status not in ('draft', 'cancelled', 'paid')
)
select
  m.billing_month,
  e.expected_rent,
  iv.invoiced_total,
  cl.collected_this_month,
  b.outstanding,
  b.overdue
from month m, expected e, invoiced iv, collected cl, balances b;

-- report_finance_summary_by_segment: same columns as 0024. The segment is
-- already the grouping key, so the grace period is simply s.segment's.
create or replace view report_finance_summary_by_segment with (security_invoker = on) as
with month as (
  select date_trunc('month', bangkok_today())::date as billing_month
),
segments as (
  select unnest(enum_range(null::property_segment)) as segment
)
select
  s.segment,
  m.billing_month,
  e.expected_rent,
  iv.invoiced_total,
  cl.collected_this_month,
  b.outstanding,
  b.overdue
from segments s
cross join month m
left join lateral (
  select coalesce(sum(c.monthly_rent), 0) as expected_rent
  from contracts c
  join rooms r on r.id = c.room_id
  where c.status = 'active'
    and r.is_test = false
    and room_property_segment(r.room_type) = s.segment
) e on true
left join lateral (
  select coalesce(sum(i.total), 0) as invoiced_total
  from invoices i
  join rooms r on r.id = i.room_id
  where i.is_test = false
    and i.billing_month = m.billing_month
    and i.status <> 'cancelled'
    and room_property_segment(r.room_type) = s.segment
) iv on true
left join lateral (
  select coalesce(sum(p.amount), 0) as collected_this_month
  from payments p
  join invoices i on i.id = p.invoice_id
  join rooms r on r.id = i.room_id
  where p.is_test = false
    and p.status = 'confirmed'
    and date_trunc('month', p.payment_date)::date = m.billing_month
    and room_property_segment(r.room_type) = s.segment
) cl on true
left join lateral (
  select
    coalesce(sum(i.total - coalesce(paid.amount, 0)), 0) as outstanding,
    coalesce(sum(
      case when i.due_date + payment_grace_days(s.segment) < bangkok_today()
        then i.total - coalesce(paid.amount, 0)
        else 0
      end
    ), 0) as overdue
  from invoices i
  join rooms r on r.id = i.room_id
  left join lateral (
    select coalesce(sum(p.amount), 0) as amount
    from payments p
    where p.invoice_id = i.id and p.status = 'confirmed'
  ) paid on true
  where i.is_test = false
    and i.status not in ('draft', 'cancelled', 'paid')
    and room_property_segment(r.room_type) = s.segment
) b on true
order by s.segment;
