-- 0032_auto_move_out_notices.sql
-- Two changes to how a move-out notice (0031) plays out:
--
-- 1. The actual move-out now happens automatically once
--    planned_move_out_date arrives, via a daily cron -- staff no longer have
--    to remember to click "Move out" on the day.
-- 2. v_room_board exposes the notice so the room list, floor plan and
--    dashboard can flag "leaving soon" without a second query.

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

-- ---------------------------------------------------------------------------
-- process_due_move_out_notices: the daily counterpart to giving notice.
-- Reuses move_out_room() per contract so an automatic move-out follows
-- exactly the same rules (must be active, vacates the room) as a manual one.
-- Cards are never auto-returned -- that stays a manual step, since a card
-- often only comes back when the tenant physically hands it over, which
-- may not line up with the date they said they'd leave.
-- ---------------------------------------------------------------------------
create or replace function process_due_move_out_notices()
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  v_contract record;
begin
  for v_contract in
    select id, planned_move_out_date, notice_note
    from contracts
    where status = 'active'
      and notice_given_at is not null
      and planned_move_out_date <= bangkok_today()
  loop
    perform move_out_room(v_contract.id, v_contract.planned_move_out_date, v_contract.notice_note, false);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function process_due_move_out_notices is
  'Daily sweep: auto-terminates a contract once its planned_move_out_date arrives. Cards are left as-is.';
