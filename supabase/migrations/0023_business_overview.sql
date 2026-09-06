-- 0023_business_overview.sql
-- Monthly owner overview: occupancy, billing, collections, and common expenses.
-- Collections are attributed to the invoice's billing month so billed-versus-
-- collected comparisons remain meaningful when payment arrives later.

create view report_business_overview with (security_invoker = on) as
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

comment on view report_business_overview is
  'Monthly real-room occupancy and finance trend. T01 is excluded in every source CTE.';
