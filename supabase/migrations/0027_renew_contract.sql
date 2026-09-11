-- 0027_renew_contract.sql
-- Renewal: ends the current contract (status -> expired) and opens a new one
-- for the SAME tenant and room, for a new term (possibly at a new rent).
-- Counterpart to move_in_room (0011) and move_out_room (0018), but touches
-- neither tenants nor rooms.status nor access_cards -- the tenant keeps
-- their existing registration, the room stays occupied throughout, and its
-- cards are already active.
--
-- SECURITY INVOKER (the default): admin/owner already holds direct
-- insert/update rights on contracts (see 0007 RLS), so this function grants
-- no privilege the caller didn't already have. Ending the old contract
-- before inserting the new one is what lets both live in the same
-- transaction despite contracts_one_active_per_room_idx allowing only one
-- active contract per room.

create or replace function renew_contract(
  p_contract_id uuid,
  p_start_date date,
  p_end_date date,
  p_monthly_rent numeric,
  p_deposit numeric,
  p_payment_due_day smallint,
  p_occupant_count smallint
)
returns uuid
language plpgsql
as $$
declare
  v_room_id uuid;
  v_tenant_id uuid;
  v_status contract_status;
  v_new_contract_id uuid;
begin
  select room_id, tenant_id, status into v_room_id, v_tenant_id, v_status
  from contracts
  where id = p_contract_id;

  if v_room_id is null then
    raise exception 'Contract % not found', p_contract_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'Contract % is not active', p_contract_id using errcode = 'check_violation';
  end if;

  update contracts set status = 'expired' where id = p_contract_id;

  insert into contracts (
    room_id, tenant_id, start_date, end_date, monthly_rent, deposit,
    payment_due_day, occupant_count, status
  )
  values (
    v_room_id, v_tenant_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, 'active'
  )
  returning id into v_new_contract_id;

  return v_new_contract_id;
end;
$$;

comment on function renew_contract is
  'Ends the current contract (status -> expired) and opens a new one for the same tenant and room. Counterpart to move_in_room/move_out_room.';
