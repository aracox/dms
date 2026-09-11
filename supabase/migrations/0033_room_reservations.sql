-- 0033_room_reservations.sql
-- A prospective tenant can pay a small fee to hold a room -- either one
-- that's already vacant, or one whose current tenant has given move-out
-- notice (0031). If they go on to sign a lease, the fee credits their
-- deposit at move-in (see moveInAction); if they never show, the dormitory
-- keeps it (marked 'forfeited').
--
-- The contract's own `deposit` still records the FULL deposit amount, not
-- deposit-minus-reservation: the reservation fee is money the dormitory
-- already holds toward that same deposit, so the refund math at move-out
-- (deposit - deposit_deduction) stays correct against what the tenant
-- actually paid in total.

create table room_reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  prospect_name text not null,
  prospect_phone text,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'held' check (status in ('held', 'applied', 'forfeited')),
  note text,
  applied_contract_id uuid references contracts (id) on delete set null,
  resolved_at date,
  is_test boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table room_reservations is
  'A prospect''s hold on a room, and the fee paid to reserve it. Applied to the deposit at move-in, or forfeited if they never sign.';
comment on column room_reservations.status is
  'held: waiting on the prospect. applied: they moved in, fee credited toward the deposit. forfeited: they never came, dormitory keeps the fee.';
comment on column room_reservations.applied_contract_id is
  'Set when status becomes applied -- the contract this reservation''s fee was credited toward.';

-- Only one open hold per room at a time.
create unique index room_reservations_one_held_per_room
  on room_reservations (room_id)
  where status = 'held';

create index room_reservations_room_idx on room_reservations (room_id, created_at desc);

alter table room_reservations enable row level security;

create policy room_reservations_select on room_reservations for select to authenticated
  using (is_staff_or_above());

create policy room_reservations_insert on room_reservations for insert to authenticated
  with check (is_admin_or_owner());

create policy room_reservations_update on room_reservations for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy room_reservations_delete on room_reservations for delete to authenticated
  using (is_owner());

create trigger room_reservations_inherit_is_test
  before insert or update of room_id on room_reservations
  for each row execute function inherit_is_test_from_room();

create trigger room_reservations_set_updated_at before update on room_reservations
  for each row execute function set_updated_at();

create trigger room_reservations_audit
  after insert or update or delete on room_reservations
  for each row execute function audit_row_change();
