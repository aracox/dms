-- 0043_report_payments.sql
-- One row per recorded payment, for the payments page's month + room search.
--
-- payment_month is the month the money arrived (payment_date), which is what
-- the page searches on; billing_month says which bill it paid. The tenant comes
-- from the invoice's own contract, not the room's current one, so an old
-- payment still names whoever paid -- the same rule as the printed receipt.
--
-- Every status is included so the list matches what was recorded; a total of
-- money received must sum status = 'confirmed' only.
--
-- Real data only: is_test = false, like every report_ view.

create view report_payments with (security_invoker = on) as
select
  p.id                                       as payment_id,
  p.payment_date,
  date_trunc('month', p.payment_date)::date  as payment_month,
  p.amount,
  p.payment_method,
  p.status,
  p.reference,
  i.id                                       as invoice_id,
  i.invoice_number,
  i.billing_month,
  r.id                                       as room_id,
  r.room_number,
  room_property_segment(r.room_type)         as property_segment,
  t.full_name                                as tenant_name
from payments p
join invoices i on i.id = p.invoice_id
join rooms r on r.id = i.room_id
left join contracts c on c.id = i.contract_id
left join tenants t on t.id = c.tenant_id
where p.is_test = false
order by p.payment_date desc, p.created_at desc;

comment on view report_payments is
  'Real payments with their bill, room and paying tenant. payment_month = month of payment_date.';

grant select on public.report_payments to authenticated, service_role;

notify pgrst, 'reload schema';
