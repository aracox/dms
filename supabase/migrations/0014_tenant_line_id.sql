-- 0014_tenant_line_id.sql
-- LINE contact for the main tenant, so the owner has a messaging channel
-- alongside the phone number. Optional, freeform (LINE ID or display name).

alter table tenants add column line_id text;

comment on column tenants.line_id is 'LINE ID or display name for messaging the tenant. Optional.';

-- move_in_room (0012) gains p_line_id as a trailing default-null parameter,
-- which CREATE OR REPLACE allows without dropping the function first.
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
  p_line_id text default null
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
    emergency_contact, emergency_phone, line_id, is_test
  )
  values (
    p_full_name, p_phone, p_email, p_id_card_or_passport, p_nationality,
    p_emergency_contact, p_emergency_phone, p_line_id, v_room_is_test
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
    set status = 'active', issued_date = p_start_date
    where room_id = p_room_id and status = 'available';
  end if;

  return query select v_contract_id, v_tenant_id;
end;
$$;
