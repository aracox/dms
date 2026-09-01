-- 0015_payment_grace_days.sql
-- Adds a configurable grace period (settings.payment_grace_days) on top of the
-- due date: an invoice only becomes 'overdue' once due_date + grace has passed,
-- not the instant due_date itself passes. Default is 0, which reproduces the
-- exact behaviour every function/view already had.
--
-- payment_grace_days() centralises the lookup, mirroring bangkok_today() (0005).
-- Every place that compared `due_date < bangkok_today()` is replaced below with
-- CREATE OR REPLACE, since 0005/0006 are already applied and append-only.

create or replace function payment_grace_days()
returns integer
language sql
stable
as $$
  select coalesce((select value::text::int from settings where key = 'payment_grace_days'), 0);
$$;

comment on function payment_grace_days is
  'Days past due_date before an invoice counts as overdue. From settings.payment_grace_days, default 0.';

-- ---------------------------------------------------------------------------
-- recalc_invoice: same body as 0005, only the overdue branch changes.
-- ---------------------------------------------------------------------------
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
    elsif v_due_date + payment_grace_days() < bangkok_today() then
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

-- ---------------------------------------------------------------------------
-- mark_overdue_invoices: same sweep, grace-aware cutoff.
-- ---------------------------------------------------------------------------
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
    and due_date + payment_grace_days() < bangkok_today();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- v_room_board: same view, financial_status's overdue branch is grace-aware.
-- ---------------------------------------------------------------------------
create or replace view v_room_board with (security_invoker = on) as
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

-- ---------------------------------------------------------------------------
-- report_finance_summary: same view, balances' overdue branch is grace-aware.
-- ---------------------------------------------------------------------------
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
      case when i.due_date + payment_grace_days() < bangkok_today()
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
