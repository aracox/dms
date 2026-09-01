-- 0019_room_board_effective_deposit.sql
-- Same fix as 0017, for deposit: v_room_board.deposit was always r.deposit --
-- the room's own (often stale/seeded) column -- even for an occupied room
-- that actually collected its contract's deposit, and even for a vacant room
-- that should show the current Settings default.

create or replace function default_deposit()
returns numeric(12, 2)
language sql
stable
as $$
  select coalesce((select value::text::numeric(12, 2) from settings where key = 'default_deposit'), 0);
$$;

comment on function default_deposit is
  'Settings default_deposit, shown as a vacant room''s deposit. Default 0.';

create or replace view v_room_board with (security_invoker = on) as
select
  r.id                                   as room_id,
  r.room_number,
  r.floor,
  r.room_type,
  r.status                               as room_status,
  coalesce(c.monthly_rent, default_monthly_rent())::numeric(12, 2) as monthly_rent,
  coalesce(c.deposit, default_deposit())::numeric(12, 2) as deposit,
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
    when inv.due_date + payment_grace_days() < bangkok_today() then 'overdue'
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
