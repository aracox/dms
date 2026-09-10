-- seed.sql
--
-- Destructive development/demo reset. This replaces all application business
-- data while preserving auth.users and profiles (the people who can sign in).
-- Run through `npm run seed -- --reset`, which requires the explicit reset flag.
--
-- Real-data policy:
--   timeline ............. 2025-01 through the current Bangkok billing month
--   rooms ................ 24 real + T01, all at 3,500 THB monthly rent
--   occupancy ............ varies from 20-24 of 24 real rooms (83.3%-100%)
--   meters/invoices ...... complete monthly history for every leased room
--   payments ............. historical invoices paid; current month has one
--                          partial and one unpaid real invoice
--   common expenses ...... six recurring categories for every seeded month
--
-- T01 remains isolated by is_test and floor 0 so Test Mode continues to work.

begin;

create or replace function seed_uuid(p_namespace text, p_key text)
returns uuid
language sql
immutable
as $$ select md5(p_namespace || ':' || p_key)::uuid $$;

-- The seed is now a reset, not an additive fixture. Keep login profiles, but
-- remove every operational, reporting, audit, and settings row from the prior
-- demo dataset. Storage objects are not seeded and are therefore out of scope.
truncate table
  common_expenses,
  tenant_documents,
  payments,
  invoice_items,
  invoices,
  meter_readings,
  maintenance_tickets,
  access_card_events,
  access_cards,
  contracts,
  tenants,
  rooms,
  settings_history,
  segment_settings_history,
  segment_settings,
  audit_logs,
  settings
restart identity cascade;

alter sequence invoice_number_seq restart with 1;

-- ===========================================================================
-- Settings
-- ===========================================================================
insert into settings (key, value, description) values
  ('electricity_rate',        '8'::jsonb,    'THB per unit (kWh)'),
  ('water_rate',              '20'::jsonb,   'THB per unit (cubic metre)'),
  ('internet_fee',            '200'::jsonb,  'THB per month, optional per room'),
  ('parking_fee_car',         '300'::jsonb,  'THB per month, optional per room, per car'),
  ('parking_fee_motorcycle',  '150'::jsonb,  'THB per month, optional per room, per motorcycle'),
  ('card_replacement_fee',    '200'::jsonb,  'THB per replaced access card'),
  ('netflix_fee',             '350'::jsonb,  'THB per month, optional per room'),
  ('youtube_fee',             '150'::jsonb,  'THB per month, optional per room'),
  ('disney_fee',              '300'::jsonb,  'THB per month, optional per room'),
  ('viu_fee',                 '100'::jsonb,  'THB per month, optional per room'),
  ('hbo_fee',                 '400'::jsonb,  'THB per month, optional per room'),
  ('amazon_prime_fee',        '150'::jsonb,  'THB per month, optional per room'),
  ('default_payment_due_day', '5'::jsonb,    'Day of month rent falls due'),
  ('payment_grace_days',      '0'::jsonb,    'Days past due before an invoice is overdue'),
  ('default_monthly_rent',    '3500'::jsonb, 'Move-in rent prefill'),
  ('default_deposit',         '3500'::jsonb, 'Move-in deposit prefill'),
  ('late_fee_per_day',        '0'::jsonb,    'Not charged in v1');

-- Whole-property settings, inserted separately so is_segment_scoped is false
-- for them. Everything above defaults to true and the settings_seed_segments
-- trigger (0025) copies each value into both หอพัก and บ้านพัก; these two
-- describe the property itself and must not be split.
insert into settings (key, value, description, is_segment_scoped) values
  ('currency',                '"THB"'::jsonb, 'Display currency', false),
  ('dormitory', '{"name_th":"หอพักตัวอย่าง","name_en":"Sample Dormitory","floors":3,"real_rooms":24}'::jsonb,
    'Property identity shown in headers and on invoices', false);

-- ===========================================================================
-- Rooms -- all room and house rents are exactly 3,500 THB.
--
-- 20 rooms are occupied. Room 107 is in maintenance, H103 is reserved, and
-- 207 / 307 are vacant. Current occupancy is therefore 20 / 24 = 83.3%.
-- ===========================================================================
insert into rooms (
  id, room_number, floor, room_type, monthly_rent, deposit, status, size_sqm,
  car_plate, motorcycle_plate, is_test
)
select
  seed_uuid('room', v.room_number),
  v.room_number,
  v.floor,
  v.room_type::room_type,
  3500,
  3500,
  v.status::room_status,
  v.sqm,
  v.car_plate,
  v.motorcycle_plate,
  false
from (values
  ('101',  1, 'air_conditioned', 'occupied',    28.0, 'กข 1101', '1กก 1101'),
  ('102',  1, 'air_conditioned', 'occupied',    28.0, null,       '1กก 1102'),
  ('103',  1, 'air_conditioned', 'occupied',    28.0, null,       null),
  ('104',  1, 'standard',        'occupied',    22.0, null,       '1กก 1104'),
  ('105',  1, 'standard',        'occupied',    22.0, null,       null),
  ('106',  1, 'standard',        'occupied',    22.0, null,       '1กก 1106'),
  ('107',  1, 'standard',        'maintenance', 22.0, null,       null),
  ('201',  2, 'air_conditioned', 'occupied',    28.0, 'กข 2201', null),
  ('202',  2, 'air_conditioned', 'occupied',    28.0, null,       '2กก 2202'),
  ('203',  2, 'air_conditioned', 'occupied',    28.0, null,       null),
  ('204',  2, 'standard',        'occupied',    22.0, null,       '2กก 2204'),
  ('205',  2, 'standard',        'occupied',    22.0, null,       null),
  ('206',  2, 'standard',        'occupied',    22.0, 'กข 2206', null),
  ('207',  2, 'standard',        'vacant',      22.0, null,       null),
  ('301',  3, 'air_conditioned', 'occupied',    28.0, null,       '3กก 3301'),
  ('302',  3, 'air_conditioned', 'occupied',    28.0, 'กข 3302', null),
  ('303',  3, 'air_conditioned', 'occupied',    28.0, null,       null),
  ('304',  3, 'standard',        'occupied',    22.0, null,       '3กก 3304'),
  ('305',  3, 'standard',        'occupied',    22.0, null,       null),
  ('306',  3, 'standard',        'occupied',    22.0, 'กข 3306', null),
  ('307',  3, 'standard',        'vacant',      22.0, null,       null),
  ('H101', 1, 'house',           'occupied',    45.0, 'กข 4101', null),
  ('H102', 1, 'house',           'occupied',    45.0, 'กข 4102', null),
  ('H103', 1, 'house',           'reserved',    45.0, null,       null)
) as v(room_number, floor, room_type, status, sqm, car_plate, motorcycle_plate);

insert into rooms (
  id, room_number, floor, room_type, monthly_rent, deposit, status, is_test, notes
)
values (
  seed_uuid('room', 'T01'),
  'T01',
  0,
  'studio',
  3500,
  3500,
  'occupied',
  true,
  'Mock room for Test Mode. Not a physical room. Never included in reporting.'
);

-- ===========================================================================
-- Access cards -- exactly two per room, activated for current occupants.
-- ===========================================================================
insert into access_cards (id, room_id, card_number, card_uid, status, replacement_fee)
select
  seed_uuid('card', r.room_number || '-' || s.slot),
  r.id,
  r.room_number || '-' || s.slot,
  case
    when r.is_test then 'TEST-CARD-00' || (case s.slot when 'A' then '1' else '2' end)
    else 'UID-' || r.room_number || '-' || s.slot
  end,
  'available',
  0
from rooms r
cross join (values ('A'), ('B')) as s(slot);

update access_cards ac
set status = 'active',
    issued_date = date '2025-01-01'
from rooms r
where r.id = ac.room_id
  and r.status = 'occupied';

update access_cards
set status = 'lost',
    replacement_fee = 200,
    notes = 'Demo lost card requiring replacement'
where card_number = '203-B';

-- ===========================================================================
-- Tenants and contracts -- 20 long-term current contracts plus realistic
-- historical turnover in the four rooms that are not currently occupied.
-- occupant_count includes the registered tenant.
-- ===========================================================================
insert into tenants (
  id, full_name, phone, email, nationality, emergency_contact, emergency_phone,
  line_id, is_test
)
select
  seed_uuid('tenant', v.room_number),
  v.full_name,
  '081' || lpad(v.ordinal::text, 7, '0'),
  'tenant.' || lower(v.room_number) || '@example.test',
  'Thai',
  'ผู้ติดต่อห้อง ' || v.room_number,
  '089' || lpad(v.ordinal::text, 7, '0'),
  'tenant_' || lower(v.room_number),
  false
from (values
  ('101',  'สมชาย ใจดี',          1),
  ('102',  'นารี สุขสันต์',        2),
  ('103',  'ประเสริฐ ทองดี',      3),
  ('104',  'มาลี พงษ์ไทย',        4),
  ('105',  'อนันต์ วงศ์ดี',        5),
  ('106',  'พิมพ์ชนก แก้วใส',     6),
  ('201',  'วิชัย ศรีสุข',         7),
  ('202',  'อรุณี แสงทอง',        8),
  ('203',  'ธนกร รัตนชัย',        9),
  ('204',  'สุรีย์พร นาคดี',      10),
  ('205',  'กิตติพงษ์ มั่นคง',    11),
  ('206',  'จุฑามาศ บุญช่วย',     12),
  ('301',  'กมล วัฒนา',           13),
  ('302',  'สุดา จันทร์เพ็ญ',      14),
  ('303',  'ชาญชัย พูนทรัพย์',    15),
  ('304',  'วิภาวี คงดี',         16),
  ('305',  'ณัฐวุฒิ สายใจ',       17),
  ('306',  'รัตนา ทองมาก',        18),
  ('H101', 'อาทิตย์ รุ่งเรือง',   19),
  ('H102', 'ศิริพร มีสุข',        20)
) as v(room_number, full_name, ordinal);

insert into tenants (
  id, full_name, phone, email, nationality, emergency_contact, emergency_phone,
  line_id, is_test
)
select
  seed_uuid('tenant', v.stay_key),
  v.full_name,
  '082' || lpad(v.ordinal::text, 7, '0'),
  'former.' || replace(v.stay_key, ':', '.') || '@example.test',
  'Thai',
  'ผู้ติดต่อผู้เช่าเดิม ' || v.room_number,
  '088' || lpad(v.ordinal::text, 7, '0'),
  'former_' || replace(v.stay_key, ':', '_'),
  false
from (values
  ('107',  '107:2025-02',  'กาญจนา พรหมดี',       1),
  ('107',  '107:2025-11',  'ธีรภัทร แก้วมณี',      2),
  ('107',  '107:2026-07',  'วราภรณ์ ชูใจ',         3),
  ('207',  '207:2025-03',  'จักรกฤษณ์ บุญมา',      4),
  ('207',  '207:2025-12',  'ณิชารีย์ สายทอง',      5),
  ('307',  '307:2025-04',  'ปกรณ์ สุขเกษม',        6),
  ('307',  '307:2026-01',  'สุภาวดี นิ่มนวล',      7),
  ('H103', 'H103:2025-05', 'พงศกร รุ่งโรจน์',      8),
  ('H103', 'H103:2026-02', 'อรพรรณ ตั้งมั่น',      9)
) as v(room_number, stay_key, full_name, ordinal);

insert into tenants (id, full_name, phone, email, nationality, is_test, notes)
values (
  seed_uuid('tenant', 'T01'),
  'Test Tenant',
  '0800000000',
  null,
  'Thai',
  true,
  'Mock tenant for Test Mode. Restored by Reset Test Data.'
);

insert into contracts (
  id, room_id, tenant_id, start_date, end_date, monthly_rent, deposit,
  payment_due_day, occupant_count, status
)
select
  seed_uuid('contract', r.room_number),
  r.id,
  t.id,
  date '2025-01-01',
  date '2027-12-31',
  3500,
  3500,
  5,
  1 + (row_number() over (order by r.room_number)::integer % 3),
  'active'
from rooms r
join tenants t on t.id = seed_uuid('tenant', r.room_number)
where r.is_test = false
  and r.status = 'occupied';

insert into contracts (
  id, room_id, tenant_id, start_date, end_date, monthly_rent, deposit,
  payment_due_day, occupant_count, status
)
select
  seed_uuid('contract', v.stay_key),
  r.id,
  seed_uuid('tenant', v.stay_key),
  v.start_date,
  v.end_date,
  3500,
  3500,
  5,
  1 + (v.ordinal % 3),
  'expired'
from (values
  ('107',  '107:2025-02',  date '2025-02-01', date '2025-09-30', 1),
  ('107',  '107:2025-11',  date '2025-11-01', date '2026-05-31', 2),
  ('107',  '107:2026-07',  date '2026-07-01', date '2026-08-31', 3),
  ('207',  '207:2025-03',  date '2025-03-01', date '2025-08-31', 4),
  ('207',  '207:2025-12',  date '2025-12-01', date '2026-04-30', 5),
  ('307',  '307:2025-04',  date '2025-04-01', date '2025-07-31', 6),
  ('307',  '307:2026-01',  date '2026-01-01', date '2026-03-31', 7),
  ('H103', 'H103:2025-05', date '2025-05-01', date '2025-06-30', 8),
  ('H103', 'H103:2026-02', date '2026-02-01', date '2026-02-28', 9)
) as v(room_number, stay_key, start_date, end_date, ordinal)
join rooms r on r.room_number = v.room_number;

insert into contracts (
  id, room_id, tenant_id, start_date, end_date, monthly_rent, deposit,
  payment_due_day, occupant_count, status
)
select
  seed_uuid('contract', 'T01'),
  r.id,
  t.id,
  date '2025-01-01',
  date '2027-12-31',
  3500,
  3500,
  5,
  2,
  'active'
from rooms r
join tenants t on t.id = seed_uuid('tenant', 'T01')
where r.room_number = 'T01';

-- ===========================================================================
-- Monthly meter history from Jan 2025 through the current Bangkok month.
-- A reading exists only when a real contract covers that billing month.
-- ===========================================================================
with real_rooms as (
  select
    r.id,
    r.room_number,
    row_number() over (
      order by (r.status = 'occupied') desc, r.room_number
    )::integer as room_rank
  from rooms r
  where r.is_test = false
),
months as (
  select
    month_start::date as billing_month,
    (row_number() over (order by month_start) - 1)::integer as month_index
  from generate_series(
    date '2025-01-01',
    date_trunc('month', bangkok_today())::date,
    interval '1 month'
  ) as month_start
),
meter_values as (
  select
    room.id as room_id,
    room.room_number,
    month.billing_month,
    month.month_index,
    room.room_rank,
    80 + (room.room_rank % 5) * 5 as electricity_usage,
    4 + (room.room_rank % 4) as water_usage
  from real_rooms room
  cross join months month
  where exists (
    select 1
    from contracts c
    where c.room_id = room.id
      and c.is_test = false
      and c.status <> 'draft'
      and c.start_date <= (month.billing_month + interval '1 month - 1 day')::date
      and coalesce(c.terminated_at, c.end_date) >= month.billing_month
  )
)
insert into meter_readings (
  id, room_id, meter_type, billing_month, previous_reading, current_reading,
  rate, recorded_at
)
select
  seed_uuid('meter', room_number || ':electricity:' || to_char(billing_month, 'YYYY-MM')),
  room_id,
  'electricity'::meter_type,
  billing_month,
  1000 + room_rank * 100 + month_index * electricity_usage,
  1000 + room_rank * 100 + (month_index + 1) * electricity_usage,
  8,
  case
    when billing_month = date_trunc('month', bangkok_today())::date
      then bangkok_today()::timestamp + interval '9 hours'
    else billing_month + interval '1 month - 1 day' + interval '9 hours'
  end
from meter_values
union all
select
  seed_uuid('meter', room_number || ':water:' || to_char(billing_month, 'YYYY-MM')),
  room_id,
  'water'::meter_type,
  billing_month,
  100 + room_rank * 10 + month_index * water_usage,
  100 + room_rank * 10 + (month_index + 1) * water_usage,
  20,
  case
    when billing_month = date_trunc('month', bangkok_today())::date
      then bangkok_today()::timestamp + interval '9 hours'
    else billing_month + interval '1 month - 1 day' + interval '9 hours'
  end
from meter_values;

insert into meter_readings (
  id, room_id, meter_type, billing_month, previous_reading, current_reading, rate
)
select
  seed_uuid('meter', 'T01:' || v.meter_type || ':' || to_char(date_trunc('month', bangkok_today()), 'YYYY-MM')),
  r.id,
  v.meter_type::meter_type,
  date_trunc('month', bangkok_today())::date,
  v.previous_reading,
  v.current_reading,
  v.rate
from rooms r
cross join (values
  ('electricity', 1250, 1380, 8),
  ('water',        220,  226, 20)
) as v(meter_type, previous_reading, current_reading, rate)
where r.room_number = 'T01';

-- ===========================================================================
-- One invoice per leased real room per month, plus the current T01 invoice.
-- Invoice totals and statuses are trigger-derived from items and payments.
-- ===========================================================================
with months as (
  select month_start::date as billing_month
  from generate_series(
    date '2025-01-01',
    date_trunc('month', bangkok_today())::date,
    interval '1 month'
  ) as month_start
)
insert into invoices (
  id, room_id, contract_id, billing_month, invoice_number, issue_date, due_date, status
)
select
  seed_uuid('invoice', r.room_number || ':' || to_char(m.billing_month, 'YYYY-MM')),
  r.id,
  c.id,
  m.billing_month,
  'INV-' || to_char(m.billing_month, 'YYYYMM') || '-' || r.room_number,
  m.billing_month,
  m.billing_month + 4,
  'issued'
from rooms r
join contracts c on c.room_id = r.id and c.status <> 'draft'
cross join months m
where r.is_test = false
  and c.start_date <= (m.billing_month + interval '1 month - 1 day')::date
  and coalesce(c.terminated_at, c.end_date) >= m.billing_month;

insert into invoices (
  id, room_id, contract_id, billing_month, invoice_number, issue_date, due_date, status
)
select
  seed_uuid('invoice', 'T01:' || to_char(date_trunc('month', bangkok_today()), 'YYYY-MM')),
  r.id,
  c.id,
  date_trunc('month', bangkok_today())::date,
  'INV-' || to_char(date_trunc('month', bangkok_today()), 'YYYYMM') || '-T01',
  date_trunc('month', bangkok_today())::date,
  date_trunc('month', bangkok_today())::date + 4,
  'issued'
from rooms r
join contracts c on c.room_id = r.id and c.status = 'active'
where r.room_number = 'T01';

insert into invoice_items (
  id, invoice_id, type, description, quantity, unit_price, sort_order
)
select
  seed_uuid('item', i.invoice_number || ':rent'),
  i.id,
  'rent',
  'Monthly rent',
  1,
  3500,
  1
from invoices i;

insert into invoice_items (
  id, invoice_id, type, description, quantity, unit_price, meter_reading_id, sort_order
)
select
  seed_uuid('item', i.invoice_number || ':' || mr.meter_type::text),
  i.id,
  mr.meter_type::text::invoice_item_type,
  case mr.meter_type
    when 'electricity' then
      'Electricity ' || to_char(mr.usage, 'FM999G999G999D00') || ' units @ ' ||
      to_char(mr.rate, 'FM999G999G999D00')
    else
      'Water ' || to_char(mr.usage, 'FM999G999G999D00') || ' units @ ' ||
      to_char(mr.rate, 'FM999G999G999D00')
  end,
  mr.usage,
  mr.rate,
  mr.id,
  case mr.meter_type when 'electricity' then 2 else 3 end
from invoices i
join meter_readings mr
  on mr.room_id = i.room_id
 and mr.billing_month = i.billing_month
where mr.usage > 0;

-- Historical months are fully paid. In the current month, ranks 1-18 are paid,
-- rank 19 is half-paid, and rank 20 remains unpaid.
with ranked_invoices as (
  select
    i.*,
    row_number() over (
      partition by i.billing_month
      order by r.room_number
    )::integer as room_rank
  from invoices i
  join rooms r on r.id = i.room_id
  where i.is_test = false
)
insert into payments (
  id, invoice_id, payment_date, amount, payment_method, reference, status, note
)
select
  seed_uuid('payment', invoice_number),
  id,
  billing_month + (1 + room_rank % 4),
  case
    when billing_month = date_trunc('month', bangkok_today())::date and room_rank = 19
      then round(total * 0.5, 2)
    else total
  end,
  case room_rank % 3
    when 0 then 'cash'::payment_method
    when 1 then 'bank_transfer'::payment_method
    else 'promptpay'::payment_method
  end,
  case when room_rank % 3 = 0 then null else 'DEMO-' || replace(invoice_number, 'INV-', '') end,
  'confirmed',
  case
    when billing_month = date_trunc('month', bangkok_today())::date and room_rank = 19
      then 'Demo partial payment'
    else null
  end
from ranked_invoices
where billing_month < date_trunc('month', bangkok_today())::date
   or room_rank <= 19;

insert into payments (
  id, invoice_id, payment_date, amount, payment_method, status, note
)
select
  seed_uuid('payment', i.invoice_number),
  i.id,
  bangkok_today(),
  i.total,
  'cash',
  'confirmed',
  'Mock payment for Test Mode'
from invoices i
where i.is_test = true;

select mark_overdue_invoices();

-- ===========================================================================
-- Recurring common expenses for the complete reporting timeline.
-- ===========================================================================
with months as (
  select
    month_start::date as billing_month,
    (row_number() over (order by month_start) - 1)::integer as month_index
  from generate_series(
    date '2025-01-01',
    date_trunc('month', bangkok_today())::date,
    interval '1 month'
  ) as month_start
),
expenses(category, description, base_amount) as (values
  ('common_electricity'::common_expense_category, 'Common-area electricity', 4800),
  ('common_water'::common_expense_category,       'Common-area water',       1200),
  ('housekeeping'::common_expense_category,       'Housekeeping wages',      4000),
  ('gardening'::common_expense_category,          'Gardening wages',         1800),
  ('internet'::common_expense_category,           'Building internet',       1200),
  ('transformer_fee'::common_expense_category,    'Transformer fee',          600)
)
insert into common_expenses (
  id, category, description, amount, expense_date, billing_month, is_test
)
select
  seed_uuid('expense', e.category::text || ':' || to_char(m.billing_month, 'YYYY-MM')),
  e.category,
  e.description,
  e.base_amount + case
    when e.category in ('common_electricity', 'common_water')
      then (m.month_index % 6) * 50
    else 0
  end,
  m.billing_month,
  m.billing_month,
  false
from months m
cross join expenses e;

-- ===========================================================================
-- Current operational examples.
-- ===========================================================================
insert into maintenance_tickets (
  id, room_id, category, description, priority, status, technician, cost
)
select
  seed_uuid('ticket', 'room-107'),
  r.id,
  'plumbing',
  'Bathroom water leak; room withdrawn from letting until repaired.',
  'high',
  'in_progress',
  'ช่างสมพงษ์',
  null
from rooms r
where r.room_number = '107';

insert into maintenance_tickets (
  id, room_id, category, description, priority, status
)
values (
  seed_uuid('ticket', 'common-lobby'),
  null,
  'electrical',
  'Lobby corridor light on floor 2 is flickering.',
  'medium',
  'open'
);

-- Seed inserts should not masquerade as user audit activity. Card events stay
-- because they are part of each card's operational history.
truncate table audit_logs, settings_history, segment_settings_history restart identity;

drop function seed_uuid(text, text);

commit;
