-- 0012_tenant_documents.sql
-- Tracks files uploaded to the tenant-documents storage bucket (0008), so the
-- app can list/link them instead of calling the Storage API to enumerate a
-- prefix. RLS mirrors the bucket's own policies: admin+ read/insert, owner delete.

create table tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tenant_documents_tenant_idx on tenant_documents (tenant_id, created_at desc);

alter table tenant_documents enable row level security;

create policy tenant_documents_select on tenant_documents for select to authenticated
  using (is_admin_or_owner());

create policy tenant_documents_insert on tenant_documents for insert to authenticated
  with check (is_admin_or_owner());

create policy tenant_documents_delete on tenant_documents for delete to authenticated
  using (is_owner());

-- ---------------------------------------------------------------------------
-- move_in_room now also hands back the new tenant_id, so the caller can attach
-- uploaded documents to it. CREATE OR REPLACE can't change a return type, so
-- the old single-uuid version is dropped first.
-- ---------------------------------------------------------------------------
drop function if exists move_in_room(
  uuid, text, text, text, text, text, text, text, date, date, numeric, numeric, smallint, smallint, boolean
);

create function move_in_room(
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
  p_activate_cards boolean
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
    emergency_contact, emergency_phone, is_test
  )
  values (
    p_full_name, p_phone, p_email, p_id_card_or_passport, p_nationality,
    p_emergency_contact, p_emergency_phone, v_room_is_test
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
