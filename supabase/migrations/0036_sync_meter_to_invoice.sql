-- 0036_sync_meter_to_invoice.sql
-- Keeps an unpaid invoice's electricity/water line in step with its month's
-- meter reading.
--
-- generate.ts copies a reading's usage and rate onto invoice_items when the
-- invoice is created. That copy is deliberate for *rates* -- changing the
-- electricity rate in Settings must not rewrite past bills -- but correcting a
-- mis-typed reading for the same month should flow through to that month's
-- bill. Without this, the reading changed and the invoice silently didn't.
--
-- Only invoices with no confirmed payment are touched (draft / issued /
-- overdue -- recalc_invoice marks any invoice with a payment partially_paid
-- or paid). Rewriting a bill the tenant has already paid against has to be a
-- deliberate step, and lowering it below what was paid would violate the
-- payments-not-above-total rule anyway. The server action tells staff when a
-- correction was NOT applied for that reason.
--
-- invoice_items.quantity must be > 0, so a reading corrected to zero usage
-- removes its line rather than zeroing it -- the same as generate.ts, which
-- never creates a zero-usage line. A reading entered after its month was
-- invoiced gets a line added. recalc_invoice (invoice_items_recalc trigger)
-- re-totals the invoice in every case.

create function sync_meter_reading_to_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_status invoice_status;
begin
  -- At most one live (non-cancelled) invoice per room and month
  -- (invoices_one_live_per_room_month_idx).
  select id, status into v_invoice_id, v_status
  from invoices
  where room_id = new.room_id
    and billing_month = new.billing_month
    and status <> 'cancelled';

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

comment on function sync_meter_reading_to_invoice is
  'Mirrors a meter reading onto its month''s unpaid invoice line. Paid/partially-paid invoices are left alone.';

create trigger meter_readings_sync_invoice
  after insert or update of previous_reading, current_reading, rate on meter_readings
  for each row execute function sync_meter_reading_to_invoice();
