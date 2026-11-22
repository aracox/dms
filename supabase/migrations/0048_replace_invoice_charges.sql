-- 0048_replace_invoice_charges.sql
-- A bill issued before its tenant moved out still charged the whole month's
-- rent and none of the final meter usage. lib/invoices/refresh.ts now
-- re-prices such a bill after a move-out (manual or automatic) and after
-- final meter numbers are recorded later. This is the write half: it swaps a
-- bill's rent / electricity / water lines for freshly worked-out ones in one
-- transaction, leaving every other line (fees, subscriptions) alone.
--
-- New lines go in before the old ones come out, so the running total only
-- ever sits above the final one: recalc_invoice (fired per row) refuses a
-- total below what has been paid, and an intermediate dip would trip it even
-- when the end result is fine. If the final total is below the confirmed
-- payments, the last delete raises and the whole swap rolls back -- the bill
-- is left exactly as it was, and the caller reports it.
--
-- security invoker: RLS on invoice_items decides who may do this, exactly as
-- for the inserts generate.ts already makes.

create or replace function replace_invoice_charges(p_invoice_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status invoice_status;
  v_old uuid[];
begin
  select status into v_status from invoices where id = p_invoice_id for update;
  if v_status is null then
    raise exception 'Invoice % not found', p_invoice_id using errcode = 'no_data_found';
  end if;
  if v_status = 'cancelled' then
    raise exception 'Invoice % is cancelled', p_invoice_id using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    where item ->> 'type' not in ('rent', 'electricity', 'water')
  ) then
    raise exception 'Only rent, electricity and water lines can be replaced'
      using errcode = 'check_violation';
  end if;

  select coalesce(array_agg(id), '{}')
  into v_old
  from invoice_items
  where invoice_id = p_invoice_id
    and type in ('rent', 'electricity', 'water');

  insert into invoice_items (
    invoice_id, type, description, quantity, unit_price, meter_reading_id, sort_order
  )
  select
    p_invoice_id,
    item.type,
    coalesce(item.description, ''),
    item.quantity,
    item.unit_price,
    item.meter_reading_id,
    item.sort_order
  from jsonb_to_recordset(p_items) as item(
    type invoice_item_type,
    description text,
    quantity numeric,
    unit_price numeric,
    meter_reading_id uuid,
    sort_order integer
  );

  delete from invoice_items where id = any (v_old);

  -- Keep the bill reading rent, electricity, water, then the fees in their
  -- original order -- the new lines may outnumber the old ones.
  with ordered as (
    select
      id,
      row_number() over (
        order by
          case type when 'rent' then 0 when 'electricity' then 1 when 'water' then 2 else 3 end,
          sort_order,
          created_at
      ) - 1 as position
    from invoice_items
    where invoice_id = p_invoice_id
  )
  update invoice_items item
  set sort_order = ordered.position
  from ordered
  where item.id = ordered.id
    and item.sort_order <> ordered.position;
end;
$$;

comment on function replace_invoice_charges is
  'Swaps a bill''s rent/electricity/water lines for the given ones atomically (0048). Raises, changing nothing, if payments would exceed the new total.';
