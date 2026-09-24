-- 0037_room_board_current_tenant_invoice.sql
-- The room board's bill status now follows the current tenant only.
--
-- v_room_board picked "the room's latest non-cancelled invoice" with no regard
-- to whose it was. After a move-out and a new move-in, the new tenant showed
-- the previous tenant's last bill -- room 101 read "occupied, paid" for a
-- tenant who had not been billed yet. The latest invoice is now taken from
-- the room's active contract; with no active contract (a vacant room) there
-- is no bill status at all.
--
-- A previous tenant's unpaid bills are not lost: report_outstanding reads
-- invoices directly, and the deposits page shows them against the deposit.
--
-- Same column list as 0032, so CREATE OR REPLACE is allowed and report_rooms
-- (select v.* ...) keeps working unchanged.

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
  coalesce(cards.total_count, 0)         as total_card_count,

  c.notice_given_at,
  c.planned_move_out_date

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
  where i.room_id = r.id
    and i.contract_id = c.id
    and i.status <> 'cancelled'
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
  'Room board for floor plan / room list / test mode. Includes test rooms -- filter on is_test. Bill status is the active contract''s latest invoice.';
