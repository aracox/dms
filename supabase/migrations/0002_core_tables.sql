-- 0002_core_tables.sql
-- Identity, settings, rooms, tenants.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, carries the application role.
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role app_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Application profile and role for each Supabase auth user.';

-- ---------------------------------------------------------------------------
-- settings: single-row-per-key application configuration (utility rates, etc.).
-- Rates here are the *current* values. Each meter reading snapshots the rate it
-- was billed at, so changing a rate never rewrites history.
-- ---------------------------------------------------------------------------
create table settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table settings is 'Key/value app configuration. Owner-writable only.';

-- ---------------------------------------------------------------------------
-- rooms: 21 real rooms on floors 1-3, plus mock room T01 on floor 0.
--
-- The floor CHECK is what keeps T01 off every production floor plan without
-- special-casing queries: real rooms are 1-3, test rooms are 0.
-- ---------------------------------------------------------------------------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  floor smallint not null,
  room_type room_type not null default 'standard',
  monthly_rent numeric(12, 2) not null default 0 check (monthly_rent >= 0),
  deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  status room_status not null default 'vacant',
  size_sqm numeric(6, 2) check (size_sqm is null or size_sqm > 0),
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rooms_test_floor_ck check (
    (is_test = false and floor between 1 and 3)
    or (is_test = true and floor = 0)
  )
);

comment on table rooms is
  '22 rows: 21 real rooms (floors 1-3) + mock room T01 (floor 0, is_test = true).';
comment on column rooms.floor is
  'Real rooms: 1-3. Test rooms: 0, which keeps them off production floor plans.';

create index rooms_floor_idx on rooms (floor) where is_test = false;
create index rooms_status_idx on rooms (status) where is_test = false;

-- ---------------------------------------------------------------------------
-- tenants: the ONE registered person per room -- main tenant and contact person
-- in a single record. Additional occupants are a count on the contract only; no
-- personal data is stored for them (see CLAUDE.md rule 2).
-- ---------------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) > 0),
  phone text not null check (length(btrim(phone)) > 0),
  email text,
  id_card_or_passport text,
  nationality text,
  emergency_contact text,
  emergency_phone text,
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table tenants is
  'Main tenant / contact person. Exactly one per contract. Additional occupants are '
  'counted in contracts.occupant_count and are intentionally not stored individually.';

create index tenants_name_idx on tenants (full_name) where is_test = false;
create index tenants_phone_idx on tenants (phone);
