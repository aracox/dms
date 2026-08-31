-- seed.sql
--
-- Development seed data. Idempotent: every id is derived from a stable key via
-- seed_uuid(), so re-running this file updates nothing and inserts nothing twice.
--
-- Contents
--   settings ............. utility rates and fees
--   rooms ................ 24 real (21 dorm rooms floors 1-3 + 3 houses on floor 1) + T01 (floor 0, is_test)
--   access_cards ......... 50 cards, <room>-A / <room>-B for all 25 rooms
--   tenants/contracts .... 9 real tenants + 1 test tenant
--   meter_readings ....... electricity + water for 2026-08
--   invoices/items ....... one per occupied room for 2026-08
--   payments ............. 7 full, 1 partial, 2 unpaid
--   maintenance .......... 1 room ticket, 1 common-area ticket, 1 test ticket
--
-- Data is realistic in shape but obviously not production: phone numbers are
-- 08x000nnnn and card UIDs are UID-<room>-<slot>.
--
-- Expected dashboard state (REAL rooms only -- T01 must not appear in any of it):
--   rooms 24 | occupied 9 | vacant 13 | reserved 1 | maintenance 1
--   occupancy 37.5% | expected rent 52,500 | invoiced Aug 63,140
--   collected Aug 46,760 | outstanding 16,380 | overdue 9,040
--
-- If T01 leaked in, collected would read 54,420 and rooms would read 25.
-- src/lib/reporting/exclusion.test.ts asserts exactly this.

begin;

create or replace function seed_uuid(p_namespace text, p_key text)
returns uuid
language sql
immutable
as $$ select md5(p_namespace || ':' || p_key)::uuid $$;

-- ===========================================================================
-- Settings
-- ===========================================================================
insert into settings (key, value, description) values
  ('electricity_rate',      '8'::jsonb,    'THB per unit (kWh)'),
  ('water_rate',            '20'::jsonb,   'THB per unit (cubic metre)'),
  ('internet_fee',          '200'::jsonb,  'THB per month, optional per room'),
  ('parking_fee',           '300'::jsonb,  'THB per month, optional per room'),
  ('card_replacement_fee',  '200'::jsonb,  'THB per replaced access card'),
  ('default_payment_due_day', '5'::jsonb,  'Day of month rent falls due'),
  ('late_fee_per_day',      '0'::jsonb,    'Not charged in v1'),
  ('currency',              '"THB"'::jsonb, 'Display currency'),
  ('dormitory', '{"name_th":"หอพักตัวอย่าง","name_en":"Sample Dormitory","floors":3,"real_rooms":24}'::jsonb,
    'Property identity shown in headers and on invoices')
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description,
      updated_at = now();

-- ===========================================================================
-- Rooms -- 24 real. x01-x03 air conditioned (6,000), x04-x07 standard (4,500),
-- H101-H103 houses (8,500) with no floor of their own (placed on floor 1).
-- ===========================================================================
insert into rooms (id, room_number, floor, room_type, monthly_rent, deposit, status, size_sqm, is_test)
select
  seed_uuid('room', v.room_number),
  v.room_number,
  v.floor,
  v.room_type::room_type,
  v.rent,
  v.deposit,
  v.status::room_status,
  v.sqm,
  false
from (values
  ('101', 1, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('102', 1, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('103', 1, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('104', 1, 'standard',        4500,  9000, 'occupied',    22.0),
  ('105', 1, 'standard',        4500,  9000, 'maintenance', 22.0),
  ('106', 1, 'standard',        4500,  9000, 'vacant',      22.0),
  ('107', 1, 'standard',        4500,  9000, 'vacant',      22.0),
  ('201', 2, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('202', 2, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('203', 2, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('204', 2, 'standard',        4500,  9000, 'vacant',      22.0),
  ('205', 2, 'standard',        4500,  9000, 'vacant',      22.0),
  ('206', 2, 'standard',        4500,  9000, 'reserved',    22.0),
  ('207', 2, 'standard',        4500,  9000, 'vacant',      22.0),
  ('301', 3, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('302', 3, 'air_conditioned', 6000, 12000, 'occupied',    28.0),
  ('303', 3, 'air_conditioned', 6000, 12000, 'vacant',      28.0),
  ('304', 3, 'standard',        4500,  9000, 'vacant',      22.0),
  ('305', 3, 'standard',        4500,  9000, 'vacant',      22.0),
  ('306', 3, 'standard',        4500,  9000, 'vacant',      22.0),
  ('307', 3, 'standard',        4500,  9000, 'vacant',      22.0),
  ('H101', 1, 'house',          8500, 17000, 'vacant',      45.0),
  ('H102', 1, 'house',          8500, 17000, 'vacant',      45.0),
  ('H103', 1, 'house',          8500, 17000, 'vacant',      45.0)
) as v(room_number, floor, room_type, rent, deposit, status, sqm)
on conflict (room_number) do nothing;

-- T01: the mock room. Floor 0 keeps it off every production floor plan, and
-- is_test = true keeps it out of every report_* view.
insert into rooms (id, room_number, floor, room_type, monthly_rent, deposit, status, is_test, notes)
values (
  seed_uuid('room', 'T01'),
  'T01',
  0,
  'studio',
  6500,
  13000,
  'occupied',
  true,
  'Mock room for Test Mode. Not a physical room. Never included in reporting.'
)
on conflict (room_number) do nothing;

-- ===========================================================================
-- Access cards -- exactly 2 per room for all 25 rooms.
--
-- Inserted as 'available', then activated by UPDATE so the
-- log_access_card_event trigger writes real history instead of us faking it.
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
cross join (values ('A'), ('B')) as s(slot)
on conflict (room_id, card_number) do nothing;

-- Activate both cards for every occupied room.
update access_cards ac
set status = 'active',
    issued_date = date '2026-01-01'
from rooms r
where r.id = ac.room_id
  and r.status = 'occupied'
  and ac.status = 'available';

-- Room 203 lost its B card -- populates the "lost cards" dashboard panel.
update access_cards
set status = 'lost',
    replacement_fee = 200,
    notes = 'Reported lost by tenant on 2026-08-18'
where card_number = '203-B';

-- ===========================================================================
-- Tenants -- the ONE registered person per room (main tenant = contact person).
-- Additional occupants exist only as contracts.occupant_count.
-- ===========================================================================
insert into tenants (
  id, full_name, phone, email, nationality, emergency_contact, emergency_phone, line_id, is_test
)
select
  seed_uuid('tenant', v.room_number),
  v.full_name,
  v.phone,
  v.email,
  'Thai',
  v.emergency_contact,
  v.emergency_phone,
  v.line_id,
  false
from (values
  ('101', 'สมชาย ใจดี',        '0810000101', 'somchai.j@example.test',  'สมหญิง ใจดี',     '0810009101', 'somchai_j'),
  ('102', 'นารี สุขสันต์',      '0810000102', 'naree.s@example.test',    'ประยุทธ สุขสันต์', '0810009102', null),
  ('103', 'ประเสริฐ ทองดี',    '0810000103', 'prasert.t@example.test',  'วันดี ทองดี',      '0810009103', null),
  ('104', 'มาลี พงษ์ไทย',      '0810000104', null,                      'สุชาติ พงษ์ไทย',   '0810009104', 'malee.p'),
  ('201', 'วิชัย ศรีสุข',       '0810000201', 'wichai.s@example.test',   'อารีย์ ศรีสุข',    '0810009201', null),
  ('202', 'อรุณี แสงทอง',      '0810000202', null,                      'บุญมา แสงทอง',     '0810009202', null),
  ('203', 'ธนกร รัตนชัย',      '0810000203', 'thanakorn.r@example.test','ปราณี รัตนชัย',    '0810009203', null),
  ('301', 'กมล วัฒนา',         '0810000301', null,                      'สมพร วัฒนา',       '0810009301', null),
  ('302', 'สุดา จันทร์เพ็ญ',    '0810000302', 'suda.c@example.test',     'ชัยวัฒน์ จันทร์เพ็ญ','0810009302', null)
) as v(room_number, full_name, phone, email, emergency_contact, emergency_phone, line_id)
on conflict (id) do nothing;

insert into tenants (id, full_name, phone, email, nationality, is_test, notes)
values (
  seed_uuid('tenant', 'T01'),
  'Test Tenant',
  '0800000000',
  null,
  'Thai',
  true,
  'Mock tenant for Test Mode. Restored by Reset Test Data.'
)
on conflict (id) do nothing;

-- ===========================================================================
-- Contracts -- occupant_count INCLUDES the main tenant.
-- 203 and 302 expire within weeks, populating "contracts expiring soon".
-- ===========================================================================
insert into contracts (
  id, room_id, tenant_id, start_date, end_date,
  monthly_rent, deposit, payment_due_day, occupant_count, status
)
select
  seed_uuid('contract', v.room_number),
  r.id,
  t.id,
  v.start_date::date,
  v.end_date::date,
  r.monthly_rent,
  r.deposit,
  v.due_day,
  v.occupants,
  'active'::contract_status
from (values
  ('101', '2026-01-01', '2026-12-31',  5, 2),
  ('102', '2026-02-01', '2027-01-31',  5, 1),
  ('103', '2026-01-01', '2026-12-31',  5, 3),
  ('104', '2026-03-01', '2027-02-28',  5, 2),
  ('201', '2026-01-01', '2026-12-31',  5, 1),
  ('202', '2026-04-01', '2027-03-31',  5, 2),
  ('203', '2025-09-16', '2026-09-15',  5, 1),
  ('301', '2026-01-01', '2026-12-31',  5, 2),
  ('302', '2025-10-01', '2026-09-30', 28, 4)
) as v(room_number, start_date, end_date, due_day, occupants)
join rooms r on r.room_number = v.room_number
join tenants t on t.id = seed_uuid('tenant', v.room_number)
on conflict (id) do nothing;

-- T01: Test Tenant + 2 occupants total, per the Test Mode defaults.
insert into contracts (
  id, room_id, tenant_id, start_date, end_date,
  monthly_rent, deposit, payment_due_day, occupant_count, status
)
select
  seed_uuid('contract', 'T01'),
  r.id,
  t.id,
  date '2026-01-01',
  date '2026-12-31',
  6500,
  13000,
  5,
  2,
  'active'
from rooms r, tenants t
where r.room_number = 'T01' and t.id = seed_uuid('tenant', 'T01')
on conflict (id) do nothing;

-- ===========================================================================
-- Meter readings for 2026-08. usage and amount are generated columns.
-- Electricity 8 THB/unit, water 20 THB/unit.
-- ===========================================================================
insert into meter_readings (
  id, room_id, meter_type, billing_month, previous_reading, current_reading, rate
)
select
  seed_uuid('meter', v.room_number || ':' || v.meter_type || ':2026-08'),
  r.id,
  v.meter_type::meter_type,
  date '2026-08-01',
  v.prev,
  v.cur,
  v.rate
from (values
  ('101', 'electricity', 1000, 1150,  8),
  ('101', 'water',        100,  108, 20),
  ('102', 'electricity',  980, 1090,  8),
  ('102', 'water',         90,   96, 20),
  ('103', 'electricity', 1200, 1420,  8),
  ('103', 'water',        150,  162, 20),
  ('104', 'electricity',  800,  890,  8),
  ('104', 'water',         70,   75, 20),
  ('201', 'electricity', 1500, 1610,  8),
  ('201', 'water',        120,  126, 20),
  ('202', 'electricity', 1100, 1235,  8),
  ('202', 'water',        110,  119, 20),
  ('203', 'electricity',  900,  980,  8),
  ('203', 'water',         60,   64, 20),
  ('301', 'electricity', 1300, 1425,  8),
  ('301', 'water',        130,  137, 20),
  ('302', 'electricity', 1050, 1190,  8),
  ('302', 'water',        100,  111, 20),
  -- T01 -- exactly the Test Mode defaults: 130 units x 8 = 1,040 and 6 x 20 = 120
  ('T01', 'electricity', 1250, 1380,  8),
  ('T01', 'water',        220,  226, 20)
) as v(room_number, meter_type, prev, cur, rate)
join rooms r on r.room_number = v.room_number
on conflict (room_id, meter_type, billing_month) do nothing;

-- ===========================================================================
-- Invoices for 2026-08. Totals are computed by trigger from the items below,
-- so the amounts here start at zero on purpose.
-- ===========================================================================
insert into invoices (
  id, room_id, contract_id, billing_month, invoice_number, issue_date, due_date, status
)
select
  seed_uuid('invoice', v.room_number || ':2026-08'),
  r.id,
  c.id,
  date '2026-08-01',
  'INV-202608-' || v.seq,
  date '2026-08-01',
  v.due_date::date,
  'issued'::invoice_status
from (values
  ('101', '00001', '2026-08-05'),
  ('102', '00002', '2026-08-05'),
  ('103', '00003', '2026-08-05'),
  ('104', '00004', '2026-08-05'),
  ('201', '00005', '2026-08-05'),
  ('202', '00006', '2026-08-05'),
  ('203', '00007', '2026-08-05'),
  ('301', '00008', '2026-08-05'),
  -- 302 pays on the 28th, so this one is still current rather than overdue.
  ('302', '00009', '2026-08-28'),
  ('T01', '00010', '2026-08-28')
) as v(room_number, seq, due_date)
join rooms r on r.room_number = v.room_number
join contracts c on c.id = seed_uuid('contract', v.room_number)
on conflict (id) do nothing;

-- Rent line.
insert into invoice_items (id, invoice_id, type, description, quantity, unit_price, sort_order)
select
  seed_uuid('item', i.invoice_number || ':rent'),
  i.id,
  'rent',
  'Monthly rent',
  1,
  c.monthly_rent,
  1
from invoices i
join contracts c on c.id = i.contract_id
where i.billing_month = date '2026-08-01'
on conflict (id) do nothing;

-- Utility lines, derived from the meter readings so the two can never disagree.
insert into invoice_items (
  id, invoice_id, type, description, quantity, unit_price, meter_reading_id, sort_order
)
select
  seed_uuid('item', i.invoice_number || ':' || mr.meter_type::text),
  i.id,
  mr.meter_type::text::invoice_item_type,
  case mr.meter_type
    when 'electricity' then 'Electricity ' || mr.usage || ' units @ ' || mr.rate
    else 'Water ' || mr.usage || ' units @ ' || mr.rate
  end,
  mr.usage,
  mr.rate,
  mr.id,
  case mr.meter_type when 'electricity' then 2 else 3 end
from invoices i
join meter_readings mr
  on mr.room_id = i.room_id
 and mr.billing_month = i.billing_month
where i.billing_month = date '2026-08-01'
  and mr.usage > 0
on conflict (id) do nothing;

-- ===========================================================================
-- Payments
--   101 102 103 201 202 301 T01 -- paid in full
--   104                        -- partial, 3,000 of 5,320
--   203 302                    -- unpaid (203 overdue, 302 still current)
-- ===========================================================================
insert into payments (
  id, invoice_id, payment_date, amount, payment_method, reference, status, note
)
select
  seed_uuid('payment', v.room_number || ':2026-08'),
  i.id,
  v.paid_on::date,
  v.amount,
  v.method::payment_method,
  v.reference,
  'confirmed'::payment_status,
  v.note
from (values
  ('101', '2026-08-03', 7360, 'bank_transfer', 'TRF-2026-0803-101', null),
  ('102', '2026-08-04', 7000, 'promptpay',     'PP-2026-0804-102',  null),
  ('103', '2026-08-02', 8000, 'cash',          null,                null),
  ('104', '2026-08-05', 3000, 'cash',          null,                'Partial payment; balance agreed for 2026-08-31'),
  ('201', '2026-08-05', 7000, 'bank_transfer', 'TRF-2026-0805-201', null),
  ('202', '2026-08-01', 7260, 'promptpay',     'PP-2026-0801-202',  null),
  ('301', '2026-08-04', 7140, 'bank_transfer', 'TRF-2026-0804-301', null),
  ('T01', '2026-08-05', 7660, 'cash',          null,                'Mock payment for Test Mode')
) as v(room_number, paid_on, amount, method, reference, note)
join invoices i on i.id = seed_uuid('invoice', v.room_number || ':2026-08')
on conflict (id) do nothing;

-- ===========================================================================
-- Maintenance
-- ===========================================================================
insert into maintenance_tickets (
  id, room_id, category, description, priority, status, technician, cost
)
select
  seed_uuid('ticket', 'room-105'),
  r.id,
  'plumbing',
  'Bathroom water leak; room withdrawn from letting until repaired.',
  'high',
  'in_progress',
  'ช่างสมพงษ์',
  null
from rooms r where r.room_number = '105'
on conflict (id) do nothing;

-- Common-area ticket: room_id is null, which is why the column is nullable.
insert into maintenance_tickets (
  id, room_id, category, description, priority, status
)
values (
  seed_uuid('ticket', 'common-lobby'),
  null,
  'electrical',
  'Lobby corridor light on floor 2 flickering.',
  'medium',
  'open'
)
on conflict (id) do nothing;

insert into maintenance_tickets (
  id, room_id, category, description, priority, status
)
select
  seed_uuid('ticket', 'T01'),
  r.id,
  'aircon',
  'Mock maintenance ticket for Test Mode.',
  'low',
  'open'
from rooms r where r.room_number = 'T01'
on conflict (id) do nothing;

drop function seed_uuid(text, text);

commit;

-- ===========================================================================
-- Promoting the first user to owner
--
-- Auth users cannot be created safely from SQL. Sign up through the app, then
-- run this once, replacing the email:
--
--   update profiles
--   set role = 'owner', full_name = 'Dormitory Owner'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ===========================================================================
