-- 0041_reservation_room_status.sql
-- A held reservation (0033) now shows on the room itself. Until now the room
-- stayed 'vacant' while someone had paid to hold it, so the floor plan, room
-- list and dashboard all offered it as free.
--
--   * holding a vacant room marks it 'reserved'
--   * forfeiting the hold puts a still-'reserved' room back to 'vacant'
--     (applying it needs nothing here: move_in_room has already made the room
--     'occupied' by the time the reservation is marked applied)
--   * moving a tenant out of a room someone has reserved -- the "reserve a
--     room whose tenant gave notice" case -- leaves it 'reserved', not 'vacant'
--
-- Only 'vacant' <-> 'reserved' is touched; an occupied or maintenance room
-- keeps its status.

create or replace function sync_room_status_from_reservation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'held' then
    update rooms set status = 'reserved'
    where id = new.room_id and status = 'vacant';
  elsif tg_op = 'UPDATE' and old.status = 'held' then
    update rooms set status = 'vacant'
    where id = new.room_id
      and status = 'reserved'
      and not exists (
        select 1 from room_reservations rr
        where rr.room_id = new.room_id and rr.status = 'held' and rr.id <> new.id
      );
  end if;
  return null;
end;
$$;

create trigger room_reservations_sync_room_status
  after insert or update of status on room_reservations
  for each row execute function sync_room_status_from_reservation();

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

  update rooms
  set status = case
    when exists (
      select 1 from room_reservations rr where rr.room_id = v_room_id and rr.status = 'held'
    ) then 'reserved'::room_status
    else 'vacant'::room_status
  end
  where id = v_room_id;

  if p_return_cards then
    update access_cards
    set status = 'returned', returned_date = p_terminated_at
    where room_id = v_room_id and status = 'active';
  end if;
end;
$$;

-- Rooms already held before this migration.
update rooms r
set status = 'reserved'
where r.status = 'vacant'
  and exists (
    select 1 from room_reservations rr where rr.room_id = r.id and rr.status = 'held'
  );
