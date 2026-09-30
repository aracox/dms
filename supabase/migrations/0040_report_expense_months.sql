-- 0040_report_expense_months.sql
-- Shared expenses per month and category, for the reports page's charts.
--
-- One row per (month, category) across every month from the earliest expense
-- to the latest one (and at least the current Bangkok month), zero-filled, so
-- a chart's x-axis has no gaps and a category with nothing recorded still
-- appears as 0 rather than disappearing.
--
-- A recurring category counts toward its billing_month; a non-recurring
-- ('other') expense has none and counts toward the month of its expense_date --
-- the same rule report_business_overview uses (0023/0039), so the two agree.
--
-- Real data only: is_test = false, like every report_ view.

create view report_expense_months with (security_invoker = on) as
with bounds as (
  select
    least(
      (select min(coalesce(billing_month, date_trunc('month', expense_date)::date))
       from common_expenses where is_test = false),
      date_trunc('month', bangkok_today())::date
    ) as first_month,
    greatest(
      (select max(coalesce(billing_month, date_trunc('month', expense_date)::date))
       from common_expenses where is_test = false),
      date_trunc('month', bangkok_today())::date
    ) as last_month
),
months as (
  select month_start::date as billing_month
  from bounds b
  cross join lateral generate_series(b.first_month, b.last_month, interval '1 month') as month_start
),
categories as (
  select unnest(enum_range(null::common_expense_category)) as category
)
select
  m.billing_month,
  c.category,
  coalesce(sum(e.amount), 0)::numeric(12, 2) as amount,
  count(e.id)                               as entry_count
from months m
cross join categories c
left join common_expenses e
  on e.is_test = false
 and e.category = c.category
 and coalesce(e.billing_month, date_trunc('month', e.expense_date)::date) = m.billing_month
group by m.billing_month, c.category
order by m.billing_month, c.category;

comment on view report_expense_months is
  'Real shared expenses per month and category, zero-filled. Non-recurring (other) count toward their expense_date month.';
