-- 0018_move_out.sql
-- The counterpart to move_in_room (0011/0012/0014): terminates the active
-- contract, vacates the room, and (if requested) returns its active access
-- cards -- all as one transaction, same reasoning as move_in_room.

create or replace function move_out_room(
  p_contract_id uuid,
  p_terminated_at date,
  p_termination_reason text,
  p_return_cards boolean
)
returns void
language plpgsql
as $$
declare
  v_room_id uuid;
  v_status contract_status;
begin
  select room_id, status into v_room_id, v_status from contracts where id = p_contract_id;

  if v_room_id is null then
    raise exception 'Contract % not found', p_contract_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'Contract % is not active', p_contract_id using errcode = 'check_violation';
  end if;

  update contracts
  set status = 'terminated',
      terminated_at = p_terminated_at,
      termination_reason = p_termination_reason
  where id = p_contract_id;

  update rooms set status = 'vacant' where id = v_room_id;

  if p_return_cards then
    update access_cards
    set status = 'returned', returned_date = p_terminated_at
    where room_id = v_room_id and status = 'active';
  end if;
end;
$$;

comment on function move_out_room is
  'Terminates a contract, vacates its room, and optionally returns active cards. Counterpart to move_in_room.';
