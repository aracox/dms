-- 0003_contracts_and_cards.sql
-- Contracts (one room + one main tenant) and room-bound access cards.

-- ---------------------------------------------------------------------------
-- contracts
--
-- occupant_count is the TOTAL number of people staying in the room, including
-- the main tenant. occupant_count = 3 means the tenant plus two others.
-- ---------------------------------------------------------------------------
create table contracts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete restrict,
  tenant_id uuid not null references tenants (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  payment_due_day smallint not null default 5 check (payment_due_day between 1 and 28),
  occupant_count smallint not null default 1 check (occupant_count >= 1),
  status contract_status not null default 'draft',
  terminated_at date,
  termination_reason text,
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contracts_date_order_ck check (end_date > start_date)
);

comment on column contracts.occupant_count is
  'Total occupants INCLUDING the main tenant. No personal data is stored for the others.';
comment on column contracts.payment_due_day is
  'Day of month rent is due. Capped at 28 so every month has the day.';

-- At most one active contract per room.
create unique index contracts_one_active_per_room_idx
  on contracts (room_id)
  where status = 'active';

create index contracts_room_idx on contracts (room_id);
create index contracts_tenant_idx on contracts (tenant_id);
create index contracts_expiring_idx on contracts (end_date)
  where status = 'active' and is_test = false;

-- ---------------------------------------------------------------------------
-- access_cards
--
-- Cards belong to the ROOM, never to a person. Exactly two per room, named
-- <room_number>-A and <room_number>-B. A trigger in 0005 rejects a third.
-- ---------------------------------------------------------------------------
create table access_cards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  card_number text not null,
  card_uid text,
  status card_status not null default 'available',
  issued_date date,
  returned_date date,
  replacement_fee numeric(12, 2) not null default 0 check (replacement_fee >= 0),
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint access_cards_slot_ck check (card_number ~ '-[AB]$'),
  constraint access_cards_returned_after_issued_ck check (
    returned_date is null or issued_date is null or returned_date >= issued_date
  ),
  unique (room_id, card_number)
);

comment on table access_cards is
  'Exactly 2 cards per room (slots A and B). Never assigned to an individual occupant.';

-- card_uid is the physical RFID identifier; unique across the building when present.
create unique index access_cards_uid_idx on access_cards (card_uid)
  where card_uid is not null;

create index access_cards_room_idx on access_cards (room_id);
create index access_cards_status_idx on access_cards (status) where is_test = false;

-- ---------------------------------------------------------------------------
-- access_card_events: append-only history so any card change can be traced.
-- ---------------------------------------------------------------------------
create table access_card_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references access_cards (id) on delete cascade,
  action card_action not null,
  from_status card_status,
  to_status card_status not null,
  fee numeric(12, 2) not null default 0 check (fee >= 0),
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table access_card_events is 'Append-only audit trail for access card state changes.';

create index access_card_events_card_idx on access_card_events (card_id, created_at desc);
