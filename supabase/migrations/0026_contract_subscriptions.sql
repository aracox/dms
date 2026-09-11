-- 0026_contract_subscriptions.sql
-- Which recurring extras (internet, parking, streaming) a contract is
-- currently subscribed to. Presence of a row = subscribed; there is no
-- separate enabled flag, so toggling off is a delete, not an update.
--
-- card_replacement_fee is deliberately excluded: it is a one-off event, not a
-- standing subscription, and stays a per-invoice checkbox in
-- GenerateInvoiceForm.

create table contract_subscriptions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  fee_key text not null check (fee_key in (
    'internet_fee', 'parking_fee_car', 'parking_fee_motorcycle',
    'netflix_fee', 'youtube_fee', 'disney_fee', 'viu_fee', 'hbo_fee', 'amazon_prime_fee'
  )),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),

  unique (contract_id, fee_key)
);

comment on table contract_subscriptions is
  'Recurring extras a contract currently pays for. Row presence = subscribed.';

create index contract_subscriptions_contract_idx on contract_subscriptions (contract_id);

-- Mirrors inherit_is_test_from_room/inherit_is_test_from_invoice (0005): a
-- child row's is_test is never trusted from the client.
create or replace function inherit_is_test_from_contract()
returns trigger
language plpgsql
as $$
declare
  v_is_test boolean;
begin
  select is_test into v_is_test from contracts where id = new.contract_id;

  if v_is_test is null then
    raise exception 'Contract % not found', new.contract_id using errcode = 'foreign_key_violation';
  end if;

  new.is_test := v_is_test;
  return new;
end;
$$;

create trigger contract_subscriptions_inherit_is_test
  before insert on contract_subscriptions
  for each row execute function inherit_is_test_from_contract();

alter table contract_subscriptions enable row level security;

-- Mirrors the contracts RLS (0007): staff read, admin+ write.
create policy contract_subscriptions_select on contract_subscriptions for select to authenticated
  using (is_staff_or_above());

create policy contract_subscriptions_insert on contract_subscriptions for insert to authenticated
  with check (is_admin_or_owner());

create policy contract_subscriptions_delete on contract_subscriptions for delete to authenticated
  using (is_admin_or_owner());
