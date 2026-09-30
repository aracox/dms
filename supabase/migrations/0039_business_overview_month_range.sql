-- 0039_business_overview_month_range.sql
-- The monthly overview views cover every month that has bills OR expenses.
--
-- Both views generated their months from the first invoice up to today. With
-- the bills cleared and billing starting over, that collapsed to the current
-- month alone: 22 months of recorded shared expenses dropped out of the
-- monthly report, and so did expenses entered ahead of time for next month.
-- The range now runs from the earliest invoice or expense month to the latest
-- one, and always includes the current (Bangkok) month.
--
-- Only the bounds CTE changes; the column lists are identical, so CREATE OR
-- REPLACE is allowed and both keep their is_test = false filters.

create or replace view report_business_overview with (security_invoker = on) as
with bounds as (
  -- least()/greatest() skip NULLs, so an empty invoices or expenses table
  -- simply drops out; today's month keeps the range from ever being empty.
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
  coalesce(e.expense_amount, 0) as expense_amount,
  coalesce(c.collected_amount, 0) - coalesce(e.expense_amount, 0) as net_after_expenses,
  case
    when coalesce(b.billed_amount, 0) = 0 then 0
    else round(coalesce(c.collected_amount, 0) * 100 / b.billed_amount, 1)
  end as collection_rate
from months m
cross join room_count rc
join occupancy o on o.billing_month = m.billing_month
left join billing b on b.billing_month = m.billing_month
left join collections c on c.billing_month = m.billing_month
left join expenses e on e.billing_month = m.billing_month
order by m.billing_month;

create or replace view report_business_overview_by_segment with (security_invoker = on) as
with bounds as (
  -- least()/greatest() skip NULLs, so an empty invoices or expenses table
  -- simply drops out; today's month keeps the range from ever being empty.
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
