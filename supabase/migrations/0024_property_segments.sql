-- 0024_property_segments.sql
-- The owner runs two things side by side and reads their numbers separately:
--
--   'dorm'  -- หอพัก: the 21 dorm rooms on floors 1-3
--   'house' -- บ้านพัก: the 3 standalone houses H101-H103
--
-- The segment is DERIVED from rooms.room_type, never stored a second time, so
-- it cannot drift from the room it describes. Only room_type = 'house' is a
-- house; every other type is a dorm room.
--
-- Common expenses stay whole-property on purpose: common_expenses has no room,
-- so there is no honest way to attribute common-area electricity or
-- housekeeping to one segment. report_business_overview keeps expenses and
-- net-after-expenses at building level and the per-segment view omits both
-- rather than inventing an allocation.

create type property_segment as enum ('dorm', 'house');

comment on type property_segment is
  'หอพัก (dorm rooms) vs บ้านพัก (standalone houses). Derived from rooms.room_type, never stored.';

create function room_property_segment(p_room_type room_type)
returns property_segment
language sql
immutable
as $$
  select case
    when p_room_type is null then null
    when p_room_type = 'house' then 'house'
    else 'dorm'
  end::property_segment;
$$;

comment on function room_property_segment is
  'Maps a room_type onto its property segment. Null in, null out -- a common-area maintenance ticket has no segment.';

-- ===========================================================================
-- Existing report_ views gain a property_segment column.
--
-- CREATE OR REPLACE appends the column at the end of each column list, which
-- is the only shape Postgres allows for a view that already exists.
-- ===========================================================================

create or replace view report_rooms with (security_invoker = on) as
select
  v.*,
  room_property_segment(v.room_type) as property_segment
from v_room_board v
where v.is_test = false;

comment on view report_rooms is
  'Real rooms only (24: 21 dorm rooms + 3 houses). Never includes T01.';

create or replace view report_contracts_expiring with (security_invoker = on) as
select
  c.id            as contract_id,
  r.id            as room_id,
  r.room_number,
  r.floor,
  t.full_name     as tenant_name,
  t.phone         as tenant_phone,
  c.start_date,
  c.end_date,
  c.monthly_rent,
  c.occupant_count,
  (c.end_date - bangkok_today()) as days_remaining,
  room_property_segment(r.room_type) as property_segment
from contracts c
join rooms r on r.id = c.room_id
join tenants t on t.id = c.tenant_id
where c.is_test = false
  and c.status = 'active'
order by c.end_date;

create or replace view report_outstanding with (security_invoker = on) as
select
  i.id            as invoice_id,
  i.invoice_number,
  i.billing_month,
  i.due_date,
  i.status,
  r.id            as room_id,
  r.room_number,
  r.floor,
  t.full_name     as tenant_name,
  i.total,
  coalesce(paid.amount, 0)             as paid_amount,
  i.total - coalesce(paid.amount, 0)   as outstanding,
  (bangkok_today() - i.due_date)       as days_overdue,
  room_property_segment(r.room_type)   as property_segment
from invoices i
join rooms r on r.id = i.room_id
left join contracts c on c.id = i.contract_id
left join tenants t on t.id = c.tenant_id
left join lateral (
  select coalesce(sum(p.amount), 0) as amount
  from payments p
  where p.invoice_id = i.id and p.status = 'confirmed'
) paid on true
where i.is_test = false
  and i.status not in ('draft', 'cancelled', 'paid')
order by i.due_date;

-- property_segment is null for a common-area ticket (room_id null).
create or replace view report_maintenance with (security_invoker = on) as
select
  m.id            as ticket_id,
  m.room_id,
  r.room_number,
  r.floor,
  m.category,
  m.description,
  m.priority,
  m.status,
  m.cost,
  m.technician,
  m.created_at,
  m.completed_at,
  room_property_segment(r.room_type) as property_segment
from maintenance_tickets m
left join rooms r on r.id = m.room_id
where m.is_test = false
order by
  case m.priority
    when 'urgent' then 0
    when 'high' then 1
    when 'medium' then 2
    else 3
  end,
  m.created_at desc;

create or replace view report_access_cards with (security_invoker = on) as
select
  ac.id           as card_id,
  ac.room_id,
  r.room_number,
  r.floor,
  ac.card_number,
  ac.card_uid,
  ac.status,
  ac.issued_date,
  ac.returned_date,
  ac.replacement_fee,
  room_property_segment(r.room_type) as property_segment
from access_cards ac
join rooms r on r.id = ac.room_id
where ac.is_test = false
order by r.room_number, ac.card_number;

-- ===========================================================================
-- Per-segment reporting views. One row per segment, always both segments.
-- ===========================================================================

create view report_room_summary_by_segment with (security_invoker = on) as
select
  property_segment                                      as segment,
  count(*)                                              as total_rooms,
  count(*) filter (where room_status = 'occupied')       as occupied,
  count(*) filter (where room_status = 'vacant')         as vacant,
  count(*) filter (where room_status = 'reserved')       as reserved,
  count(*) filter (where room_status = 'maintenance')    as maintenance,
  case
    when count(*) = 0 then 0
    else round(
      count(*) filter (where room_status = 'occupied')::numeric * 100 / count(*),
      1
    )
  end                                                   as occupancy_rate
from report_rooms
group by property_segment
order by segment;

comment on view report_room_summary_by_segment is
  'report_room_summary split by property segment. Derives from report_rooms, so T01 is already gone.';

-- Same arithmetic as report_finance_summary (0015), narrowed to one segment.
create view report_finance_summary_by_segment with (security_invoker = on) as
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
-- Rent this segment should bill this month, from active contracts.
left join lateral (
  select coalesce(sum(c.monthly_rent), 0) as expected_rent
  from contracts c
  join rooms r on r.id = c.room_id
  where c.status = 'active'
    and r.is_test = false
    and room_property_segment(r.room_type) = s.segment
) e on true
-- What has actually been invoiced for the current month.
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
-- Outstanding and overdue span all months, not just the current one.
left join lateral (
  select
    coalesce(sum(i.total - coalesce(paid.amount, 0)), 0) as outstanding,
    coalesce(sum(
      case when i.due_date + payment_grace_days() < bangkok_today()
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

comment on view report_finance_summary_by_segment is
  'report_finance_summary split by property segment. Every source filters is_test = false.';

create view report_tenant_summary_by_segment with (security_invoker = on) as
select
  room_property_segment(r.room_type) as segment,
  count(distinct c.tenant_id)        as registered_tenants,
  coalesce(sum(c.occupant_count), 0) as total_occupants
from contracts c
join rooms r on r.id = c.room_id
where c.is_test = false
  and r.is_test = false
  and c.status = 'active'
group by 1
order by 1;

comment on view report_tenant_summary_by_segment is
  'report_tenant_summary split by property segment.';

-- Monthly trend per segment. Occupancy, billing and collections only --
-- see the header note on why expenses stay whole-property.
create view report_business_overview_by_segment with (security_invoker = on) as
with bounds as (
  select
    coalesce(
      (select min(billing_month) from invoices where is_test = false),
      date_trunc('month', bangkok_today())::date
    ) as first_month,
    date_trunc('month', bangkok_today())::date as current_month
),
months as (
  select month_start::date as billing_month
  from bounds b
  cross join lateral generate_series(
    b.first_month,
    b.current_month,
    interval '1 month'
  ) as month_start
),
segments as (
  select
    room_property_segment(r.room_type) as segment,
    count(*)::numeric                  as total_rooms
  from rooms r
  where r.is_test = false
  group by 1
)
select
  m.billing_month,
  s.segment,
  occ.occupied_rooms,
  s.total_rooms::bigint as total_rooms,
  case
    when s.total_rooms = 0 then 0
    else round(occ.occupied_rooms::numeric * 100 / s.total_rooms, 1)
  end as occupancy_rate,
  bill.billed_amount,
  coll.collected_amount,
  case
    when bill.billed_amount = 0 then 0
    else round(coll.collected_amount * 100 / bill.billed_amount, 1)
  end as collection_rate
from months m
cross join segments s
left join lateral (
  select count(distinct c.room_id) as occupied_rooms
  from contracts c
  join rooms r on r.id = c.room_id
  where c.is_test = false
    and c.status <> 'draft'
    and room_property_segment(r.room_type) = s.segment
    and c.start_date <= (m.billing_month + interval '1 month - 1 day')::date
    and coalesce(c.terminated_at, c.end_date) >= m.billing_month
) occ on true
left join lateral (
  select coalesce(sum(i.total), 0) as billed_amount
  from invoices i
  join rooms r on r.id = i.room_id
  where i.is_test = false
    and i.status <> 'cancelled'
    and i.billing_month = m.billing_month
    and room_property_segment(r.room_type) = s.segment
) bill on true
-- Collections are attributed to the invoice's billing month, so a late payment
-- still lands against the month it settles.
left join lateral (
  select coalesce(sum(p.amount), 0) as collected_amount
  from invoices i
  join payments p on p.invoice_id = i.id
  join rooms r on r.id = i.room_id
  where i.is_test = false
    and p.is_test = false
    and i.status <> 'cancelled'
    and p.status = 'confirmed'
    and i.billing_month = m.billing_month
    and room_property_segment(r.room_type) = s.segment
) coll on true
order by m.billing_month, s.segment;

comment on view report_business_overview_by_segment is
  'Monthly occupancy/billed/collected per property segment. Expenses are building-wide and stay in report_business_overview.';
