-- 0029_line_notifications.sql
-- LINE Messaging API integration for payment-due and contract-expiry
-- reminders.
--
-- tenants.line_id (0014) is a free-text display name/handle staff type in by
-- hand -- it can never be a push-message target. The Messaging API will only
-- push to a userId it captured itself, via a webhook, after the tenant adds
-- the dormitory's Official Account as a friend. line_user_id and
-- line_link_code below support that: staff generate a one-time code and give
-- it to the tenant, the tenant sends that code to the OA, and the webhook
-- matches the code to link line_user_id.

alter table tenants
  add column line_user_id text,
  add column line_link_code text;

comment on column tenants.line_user_id is
  'Real LINE Messaging API userId, captured via webhook once the tenant links their account. Null until linked.';
comment on column tenants.line_link_code is
  'One-time code given to the tenant so the webhook can match their incoming LINE message to this tenant. Cleared once linked.';

create unique index tenants_line_user_id_idx on tenants (line_user_id) where line_user_id is not null;
create unique index tenants_line_link_code_idx on tenants (line_link_code) where line_link_code is not null;

-- ---------------------------------------------------------------------------
-- line_reminders_sent: dedup log so the daily sweep never pushes the same
-- reminder twice for the same invoice/contract.
-- ---------------------------------------------------------------------------
create table line_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('invoice_due', 'contract_expiring')),
  entity_id uuid not null,
  tenant_id uuid not null references tenants (id) on delete cascade,
  sent_at timestamptz not null default now(),

  unique (entity_type, entity_id)
);

alter table line_reminders_sent enable row level security;

-- Only ever written by the cron sweep via the service-role client (bypasses
-- RLS), so the only policy needed is read access for admin+ to review history.
create policy line_reminders_sent_select on line_reminders_sent for select to authenticated
  using (is_admin_or_owner());

-- ---------------------------------------------------------------------------
-- Candidate queries for the reminder sweep. Both are read-only and take a
-- day offset so the same function serves any lead time without a redeploy.
-- ---------------------------------------------------------------------------
create or replace function due_soon_invoices_for_line(p_days_ahead int)
returns table (
  invoice_id uuid,
  tenant_id uuid,
  line_user_id text,
  room_number text,
  tenant_name text,
  due_date date,
  outstanding numeric
)
language sql
stable
as $$
  select
    i.id,
    t.id,
    t.line_user_id,
    r.room_number,
    t.full_name,
    i.due_date,
    i.total - coalesce(paid.amount, 0)
  from invoices i
  join rooms r on r.id = i.room_id
  join contracts c on c.id = i.contract_id
  join tenants t on t.id = c.tenant_id
  left join lateral (
    select sum(p.amount) as amount from payments p
    where p.invoice_id = i.id and p.status = 'confirmed'
  ) paid on true
  where i.is_test = false
    and i.status in ('issued', 'partially_paid')
    and i.due_date = bangkok_today() + p_days_ahead
    and t.line_user_id is not null
    and not exists (
      select 1 from line_reminders_sent s
      where s.entity_type = 'invoice_due' and s.entity_id = i.id
    );
$$;

create or replace function expiring_contracts_for_line(p_days_ahead int)
returns table (
  contract_id uuid,
  tenant_id uuid,
  line_user_id text,
  room_number text,
  tenant_name text,
  end_date date
)
language sql
stable
as $$
  select
    c.id,
    t.id,
    t.line_user_id,
    r.room_number,
    t.full_name,
    c.end_date
  from contracts c
  join rooms r on r.id = c.room_id
  join tenants t on t.id = c.tenant_id
  where c.is_test = false
    and c.status = 'active'
    and c.end_date = bangkok_today() + p_days_ahead
    and t.line_user_id is not null
    and not exists (
      select 1 from line_reminders_sent s
      where s.entity_type = 'contract_expiring' and s.entity_id = c.id
    );
$$;
