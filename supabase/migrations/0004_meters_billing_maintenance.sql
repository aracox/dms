-- 0004_meters_billing_maintenance.sql
-- Meter readings, invoicing, payments, maintenance, audit log.
--
-- Financial arithmetic lives in the database (generated columns + triggers in 0005),
-- never in the browser. See CLAUDE.md rule 4.

-- ---------------------------------------------------------------------------
-- meter_readings
--
-- usage and amount are GENERATED columns, so they cannot be written by a client
-- and cannot disagree with the readings they derive from. A generated column may
-- not reference another generated column, hence the repeated subtraction.
-- ---------------------------------------------------------------------------
create table meter_readings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  meter_type meter_type not null,
  billing_month date not null,
  previous_reading numeric(12, 2) not null check (previous_reading >= 0),
  current_reading numeric(12, 2) not null check (current_reading >= 0),
  rate numeric(12, 4) not null check (rate >= 0),

  usage numeric(12, 2)
    generated always as (current_reading - previous_reading) stored,
  amount numeric(12, 2)
    generated always as (round((current_reading - previous_reading) * rate, 2)) stored,

  note text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meter_readings_not_reversed_ck check (current_reading >= previous_reading),
  constraint meter_readings_month_is_first_day_ck check (extract(day from billing_month) = 1),
  unique (room_id, meter_type, billing_month)
);

comment on column meter_readings.rate is
  'Rate snapshot at billing time. Changing the rate in settings never rewrites history.';
comment on column meter_readings.billing_month is 'Always the first day of the month.';

create index meter_readings_month_idx on meter_readings (billing_month)
  where is_test = false;

-- ---------------------------------------------------------------------------
-- invoices
--
-- subtotal / discount / total are maintained by trigger from invoice_items.
-- Treat them as read-only from application code.
-- ---------------------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete restrict,
  contract_id uuid references contracts (id) on delete set null,
  billing_month date not null,
  invoice_number text not null unique,
  issue_date date,
  due_date date not null,

  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),

  status invoice_status not null default 'draft',
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_month_is_first_day_ck check (extract(day from billing_month) = 1),
  constraint invoices_discount_within_subtotal_ck check (discount <= subtotal)
);

comment on column invoices.total is 'Trigger-maintained: subtotal - discount. Do not write directly.';

-- One live invoice per room per month; cancelled ones do not block a reissue.
create unique index invoices_one_live_per_room_month_idx
  on invoices (room_id, billing_month)
  where status <> 'cancelled';

create index invoices_status_idx on invoices (status) where is_test = false;
create index invoices_month_idx on invoices (billing_month) where is_test = false;
create index invoices_due_date_idx on invoices (due_date)
  where is_test = false and status in ('issued', 'partially_paid', 'overdue');

-- ---------------------------------------------------------------------------
-- invoice_items
-- 'discount' rows carry a positive amount and are subtracted from the subtotal.
-- ---------------------------------------------------------------------------
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  type invoice_item_type not null,
  description text not null default '',
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  amount numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  meter_reading_id uuid references meter_readings (id) on delete set null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_idx on invoice_items (invoice_id, sort_order);

-- ---------------------------------------------------------------------------
-- payments
--
-- Partial payments are supported. A trigger blocks the confirmed total from
-- exceeding the invoice total and derives paid / partially_paid.
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  payment_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method payment_method not null,
  reference text,
  slip_path text,
  status payment_status not null default 'confirmed',
  note text,
  recorded_by uuid references auth.users (id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column payments.slip_path is
  'Supabase Storage object path: payment-slips/{roomId}/{invoiceId}/{filename}';
comment on column payments.status is
  'Only confirmed payments settle an invoice or count toward collection reporting.';

create index payments_invoice_idx on payments (invoice_id);
create index payments_date_idx on payments (payment_date) where is_test = false;

-- ---------------------------------------------------------------------------
-- maintenance_tickets
-- room_id is nullable: tickets may cover common areas (lift, car park, lobby).
-- ---------------------------------------------------------------------------
create table maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms (id) on delete set null,
  category text not null,
  description text not null,
  priority maintenance_priority not null default 'medium',
  status maintenance_status not null default 'open',
  cost numeric(12, 2) check (cost is null or cost >= 0),
  technician text,
  photo_path text,
  reported_by uuid references auth.users (id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint maintenance_completed_consistency_ck check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

comment on column maintenance_tickets.room_id is
  'Nullable so tickets can cover common areas rather than a specific room.';

create index maintenance_room_idx on maintenance_tickets (room_id);
create index maintenance_open_idx on maintenance_tickets (status)
  where is_test = false and status in ('open', 'in_progress', 'waiting');

-- ---------------------------------------------------------------------------
-- audit_logs: important business changes (invoices, payments, contracts,
-- access cards, meter corrections).
-- ---------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action audit_action not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);
