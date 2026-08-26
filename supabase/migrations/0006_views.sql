-- 0006_views.sql
--
-- Two layers, and the distinction is the whole point:
--
--   v_*       operational views. Carry is_test. The floor plan, room pages and
--             Test Mode read these and filter explicitly.
--   report_*  reporting views. Hard-filter is_test = false. There is no way to
--             ask them for test data. Every dashboard/report number comes from here.
--
-- security_invoker = on so the caller's RLS still applies through the view.

-- ===========================================================================
-- Operational
-- ===========================================================================

-- One row per room (all 22) with the current contract, tenant, latest invoice,
-- derived financial status and operational counts. Single source of truth for the
-- floor plan, the rooms list and Test Mode.
create view v_room_board with (security_invoker = on) as
select
  r.id                                   as room_id,
  r.room_number,
  r.floor,
  r.room_type,
  r.status                               as room_status,
  r.monthly_rent,
  r.deposit,
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
    when inv.due_date < bangkok_today() then 'overdue'
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

-- ===========================================================================
-- Reporting -- is_test = false is baked in and cannot be overridden
-- ===========================================================================

create view report_rooms with (security_invoker = on) as
select * from v_room_board where is_test = false;

comment on view report_rooms is 'Real rooms only (21). Never includes T01.';

create view report_room_summary with (security_invoker = on) as
select
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
from report_rooms;

create view report_finance_summary with (security_invoker = on) as
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
      case when i.due_date < bangkok_today()
        then i.total - coalesce(paid.amount, 0)
        else 0
      end
    ), 0) as overdue
  from invoices i
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

create view report_contracts_expiring with (security_invoker = on) as
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
  (c.end_date - bangkok_today()) as days_remaining
from contracts c
join rooms r on r.id = c.room_id
join tenants t on t.id = c.tenant_id
where c.is_test = false
  and c.status = 'active'
order by c.end_date;

create view report_outstanding with (security_invoker = on) as
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
  (bangkok_today() - i.due_date)       as days_overdue
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

create view report_payment_collection with (security_invoker = on) as
select
  date_trunc('month', p.payment_date)::date            as month,
  p.payment_method,
  count(*)                                             as payment_count,
  coalesce(sum(p.amount), 0)                           as total_amount
from payments p
where p.is_test = false and p.status = 'confirmed'
group by 1, 2
order by 1 desc, 2;

create view report_meter_usage with (security_invoker = on) as
select
  mr.billing_month,
  mr.meter_type,
  r.id                     as room_id,
  r.room_number,
  r.floor,
  mr.previous_reading,
  mr.current_reading,
  mr.usage,
  mr.rate,
  mr.amount
from meter_readings mr
join rooms r on r.id = mr.room_id
where mr.is_test = false
order by mr.billing_month desc, r.room_number, mr.meter_type;

create view report_maintenance with (security_invoker = on) as
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
  m.completed_at
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

create view report_access_cards with (security_invoker = on) as
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
  ac.replacement_fee
from access_cards ac
join rooms r on r.id = ac.room_id
where ac.is_test = false
order by r.room_number, ac.card_number;

create view report_tenant_summary with (security_invoker = on) as
select
  count(distinct c.tenant_id)          as registered_tenants,
  coalesce(sum(c.occupant_count), 0)   as total_occupants
from contracts c
where c.is_test = false and c.status = 'active';
