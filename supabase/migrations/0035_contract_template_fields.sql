-- 0035_contract_template_fields.sql
-- Fields needed to fill the owner-supplied contract template
-- (สัญญาเช่าห้องพัก.docx): the lessor's ID card, address and phone; a bank
-- account to receive rent; the property's address; and the tenant's address.
-- All new identity/bank fields are segment-scoped like owner_name and
-- property_name (migration 0030/0034) -- หอพัก and บ้านพัก can use a
-- different owner identity or bank account.

-- ---------------------------------------------------------------------------
-- Tenant address. Fixed at move-in like id_card_or_passport and nationality
-- -- see tenants comment and updateTenantContactAction, which only ever
-- touches the fields that can change mid-tenancy.
-- ---------------------------------------------------------------------------
alter table tenants add column address text;

comment on column tenants.address is 'Registered address, fixed at move-in. Shown on the lease contract.';

-- move_in_room (0012, 0014) gains p_address as a trailing default-null
-- parameter, same technique 0014 used for p_line_id.
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
    set status = 'active', issued_date = p_start_date
    where room_id = p_room_id and status = 'available';
  end if;

  return query select v_contract_id, v_tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner identity grows beyond just a name: id card, address, phone -- the
-- lessor party block on the contract. Same key (owner_name), extended shape,
-- since it is still "the owner's identity for this segment" and every reader
-- already goes through getOwnerName(). jsonb needs no column migration; both
-- existing rows are backfilled with empty strings for the new fields.
--
-- settings.value itself is frozen for segment-scoped keys (0025) and is not
-- read by the app for this key (getOwnerName reads segment_settings only),
-- so only segment_settings is updated. description is not value, so it can
-- still be updated directly.
-- ---------------------------------------------------------------------------
update segment_settings
set value = value || '{"id_card": "", "address": "", "phone": ""}'::jsonb
where key = 'owner_name';

update settings
set description = 'Segment-specific owner identity (name_th/name_en/id_card/address/phone), the lessor party shown on that segment''s contract.'
where key = 'owner_name';

-- ---------------------------------------------------------------------------
-- Bank account the tenant pays rent into, shown in the contract's payment
-- section. Segment-scoped: dorm and house may settle into different accounts.
-- ---------------------------------------------------------------------------
insert into settings (key, value, description)
values (
  'payment_bank',
  '{"bank_name": "", "account_number": "", "account_name": ""}'::jsonb,
  'Segment-specific bank account (bank_name/account_number/account_name) shown on that segment''s contract.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Property/building address, shown in the "ทรัพย์สินที่เช่า" section of the
-- contract alongside property_name. Segment-scoped like property_name.
-- ---------------------------------------------------------------------------
insert into settings (key, value, description)
values (
  'property_address',
  '""'::jsonb,
  'Segment-specific property address shown on that segment''s contract.'
)
on conflict (key) do nothing;
