-- 0045_tenancy_fixes.sql
-- Fixes found by the end-to-end regression run (2026-11-20).
--
-- 1. Key cards for a second tenant. move_out_room marks a room's cards
--    'returned', but move_in_room only activated 'available' ones, so from a
--    room's second tenant on, "activate cards" silently did nothing. Returned
--    cards are now re-activated too (lost / damaged / disabled still are not).
--
-- 2. One bill per CONTRACT per month, not per room. A mid-month turnover left
--    the incoming tenant's part month unbillable, because the outgoing tenant
--    already held the room's bill for that month.
--
-- 3. The meter -> invoice sync (0036) picked "the" room/month invoice, which
--    is no longer unique. It now follows the same rule as generate.ts: the
--    bill already carrying this reading, else the bill of the contract that
--    started last (the tenant in the room at month end, when meters are read).
--
-- 4. settle_deposit: settle a deposit and, when the owner chooses, pay the
--    tenant's unpaid bills from it -- in one transaction, so a half-applied
--    settlement cannot leave bills paid but the deposit unsettled.

-- 1 -------------------------------------------------------------------------
create or replace function move_in_room(
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
  p_address text default null
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
    payment_due_day, occupant_count, status
  )
  values (
    p_room_id, v_tenant_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, 'active'
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

-- 2 -------------------------------------------------------------------------
drop index invoices_one_live_per_room_month_idx;

-- Cancelled bills still do not block a reissue.
create unique index invoices_one_live_per_contract_month_idx
  on invoices (contract_id, billing_month)
  where status <> 'cancelled';

-- 3 -------------------------------------------------------------------------
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
  -- A room can hold two live bills in a turnover month, one per contract.
  -- The reading belongs to the one already carrying it, else to the bill of
  -- the contract that started last -- the rule generate.ts uses.
  select i.id, i.status into v_invoice_id, v_status
  from invoices i
  left join contracts c on c.id = i.contract_id
  where i.room_id = new.room_id
    and i.billing_month = new.billing_month
    and i.status <> 'cancelled'
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

    -- A line orphaned by a deleted reading (meter_reading_id is set null on
    -- delete) is adopted rather than duplicated when the reading is re-entered.
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

-- 4 -------------------------------------------------------------------------
-- Raises with a translation key as the message, so the server action can show
-- it as-is: contract.notTerminated, contract.alreadySettled,
-- contract.refundExceedsDeposit, contract.deductionBelowOwed.
create function settle_deposit(
  p_contract_id uuid,
  p_refund numeric,
  p_reason text,
  p_pay_bills boolean
)
returns void
language plpgsql
as $$
declare
  v_contract contracts%rowtype;
  v_deduction numeric(12, 2);
  v_owed numeric(12, 2);
  v_bill record;
begin
  select * into v_contract from contracts where id = p_contract_id for update;

  if not found then
    raise exception 'Contract % not found', p_contract_id using errcode = 'no_data_found';
  end if;
  if v_contract.status <> 'terminated' then
    raise exception 'contract.notTerminated' using errcode = 'check_violation';
  end if;
  -- Re-submitting must not take the bills out of the deposit twice.
  if v_contract.deposit_settled_at is not null then
    raise exception 'contract.alreadySettled' using errcode = 'check_violation';
  end if;
  if p_refund < 0 or p_refund > v_contract.deposit then
    raise exception 'contract.refundExceedsDeposit' using errcode = 'check_violation';
  end if;

  v_deduction := v_contract.deposit - p_refund;

  if p_pay_bills then
    -- What this tenant still owes on their own bills (not the room's).
    select coalesce(sum(i.total - coalesce(paid.amount, 0)), 0) into v_owed
    from invoices i
    left join lateral (
      select sum(p.amount) as amount from payments p
      where p.invoice_id = i.id and p.status = 'confirmed'
    ) paid on true
    where i.contract_id = p_contract_id
      and i.status in ('issued', 'overdue', 'partially_paid');

    if v_owed > v_deduction then
      raise exception 'contract.deductionBelowOwed' using errcode = 'check_violation';
    end if;

    for v_bill in
      select i.id, i.total - coalesce(paid.amount, 0) as owed
      from invoices i
      left join lateral (
        select sum(p.amount) as amount from payments p
        where p.invoice_id = i.id and p.status = 'confirmed'
      ) paid on true
      where i.contract_id = p_contract_id
        and i.status in ('issued', 'overdue', 'partially_paid')
      order by i.billing_month
    loop
      if v_bill.owed > 0 then
        insert into payments (invoice_id, payment_date, amount, payment_method, status, recorded_by)
        values (v_bill.id, bangkok_today(), v_bill.owed, 'deposit', 'confirmed', auth.uid());
      end if;
    end loop;
  end if;

  update contracts
  set deposit_deduction = v_deduction,
      deposit_refund = p_refund,
      deposit_settled_at = bangkok_today(),
      deposit_settlement_note = p_reason
  where id = p_contract_id;
end;
$$;

comment on function settle_deposit is
  'Settles a terminated contract''s deposit; with p_pay_bills, pays its unpaid bills from the deposit (method deposit) in the same transaction.';

notify pgrst, 'reload schema';
