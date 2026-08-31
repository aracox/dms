-- 0010_settings_history.sql
-- Audit trail of every settings value change (who, when, old/new value).
--
-- This is reference/audit only. Billing math never reads it: a rate or fee
-- is snapshotted onto meter_readings.rate / invoice_items.unit_price at the
-- moment it's used (see 0004), so past months already stay correct when a
-- setting changes -- that guarantee does not depend on this table existing.

create table settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null references settings (key) on delete cascade,
  old_value jsonb,
  new_value jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table settings_history is
  'Append-only log of settings value changes, written by a trigger on settings. Audit/reference only.';

create index settings_history_key_idx on settings_history (key, changed_at desc);

alter table settings_history enable row level security;

create policy settings_history_select on settings_history for select to authenticated
  using (is_staff_or_above());

-- No insert/update/delete policy: only the trigger below writes this table.

create trigger settings_set_updated_at before update on settings
  for each row execute function set_updated_at();

create or replace function log_settings_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into settings_history (key, old_value, new_value, changed_by)
  values (new.key, old.value, new.value, new.updated_by);
  return new;
end;
$$;

create trigger on_settings_value_changed
  after update on settings
  for each row
  when (old.value is distinct from new.value)
  execute function log_settings_history();
