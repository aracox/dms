-- 0020_common_expenses.sql
-- Building-wide operating costs the owner incurs regardless of any one room:
-- common-area electricity/water, housekeeping, gardening wages. Ad hoc
-- repairs stay in maintenance_tickets (room_id null already models a
-- common-area ticket, cost included) -- this table is for recurring
-- overhead with no ticket workflow around it, not a second repair-cost path.

create type common_expense_category as enum (
  'common_electricity',
  'common_water',
  'housekeeping',
  'gardening',
  'other'
);

create table common_expenses (
  id uuid primary key default gen_random_uuid(),
  category common_expense_category not null,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null,
  recorded_by uuid references auth.users (id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index common_expenses_date_idx on common_expenses (expense_date) where is_test = false;

comment on table common_expenses is
  'Recurring building-wide operating costs (utilities, housekeeping, gardening). Repairs are maintenance_tickets with room_id null.';

alter table common_expenses enable row level security;

create policy common_expenses_select on common_expenses for select to authenticated
  using (is_staff_or_above());

create policy common_expenses_insert on common_expenses for insert to authenticated
  with check (is_admin_or_owner());

create policy common_expenses_update on common_expenses for update to authenticated
  using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy common_expenses_delete on common_expenses for delete to authenticated
  using (is_owner());

create trigger common_expenses_set_updated_at before update on common_expenses
  for each row execute function set_updated_at();

create trigger common_expenses_audit
  after insert or update or delete on common_expenses
  for each row execute function audit_row_change();
