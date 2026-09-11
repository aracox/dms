-- 0031_move_out_notice.sql
-- Advance move-out notice: a tenant tells staff today they're leaving on a
-- future date, well before (or at) the lease's natural end_date. The
-- contract stays 'active' and the room stays occupied until the actual
-- move-out is recorded (move_out_room, 0018) -- this is only a heads-up so
-- staff know a vacancy is coming and can start lining up the next tenant.

alter table contracts
  add column notice_given_at date,
  add column planned_move_out_date date,
  add column notice_note text;

comment on column contracts.notice_given_at is
  'When the tenant told staff they are leaving early. Null until notice is given.';
comment on column contracts.planned_move_out_date is
  'The date the tenant said they will vacate. Independent of end_date -- notice can come well before the lease naturally ends.';
comment on column contracts.notice_note is
  'Optional detail recorded with the notice (reason, etc).';

alter table contracts
  add constraint contracts_notice_consistency_ck check (
    (notice_given_at is not null and planned_move_out_date is not null)
    or (notice_given_at is null and planned_move_out_date is null and notice_note is null)
  ),
  add constraint contracts_notice_date_order_ck check (
    planned_move_out_date is null or planned_move_out_date >= notice_given_at
  );

-- ---------------------------------------------------------------------------
-- report_move_out_notices: active contracts with an open notice, for the
-- dashboard. Mirrors report_contracts_expiring's shape, but ordered by the
-- tenant's stated date rather than the lease's end_date.
-- ---------------------------------------------------------------------------
create view report_move_out_notices with (security_invoker = on) as
select
  c.id                      as contract_id,
  r.id                      as room_id,
  r.room_number,
  r.floor,
  t.full_name               as tenant_name,
  t.phone                   as tenant_phone,
  c.notice_given_at,
  c.planned_move_out_date,
  c.notice_note,
  (c.planned_move_out_date - bangkok_today()) as days_remaining,
  room_property_segment(r.room_type) as property_segment
from contracts c
join rooms r on r.id = c.room_id
join tenants t on t.id = c.tenant_id
where c.is_test = false
  and c.status = 'active'
  and c.notice_given_at is not null
order by c.planned_move_out_date;

comment on view report_move_out_notices is
  'Active contracts whose tenant has given move-out notice. Real rooms only.';
