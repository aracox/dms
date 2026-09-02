-- 0021_common_expenses_monthly.sql
-- Splits common_expenses into two shapes it was conflating:
--   - The 4 recurring categories (common_electricity, common_water,
--     housekeeping, gardening) are monthly: exactly one row per category per
--     month, like meter_readings. billing_month is required for these.
--   - 'other' is the ad hoc bucket: a free description + a specific date the
--     owner picks, no month-uniqueness. billing_month must be null for these.

alter table common_expenses
  add column billing_month date;

alter table common_expenses
  add constraint common_expenses_billing_month_ck check (
    (category = 'other' and billing_month is null)
    or (category <> 'other' and billing_month is not null)
  );

alter table common_expenses
  add constraint common_expenses_month_is_first_day_ck check (
    billing_month is null or extract(day from billing_month) = 1
  );

create unique index common_expenses_monthly_uk
  on common_expenses (category, billing_month)
  where category <> 'other';

comment on column common_expenses.billing_month is
  'Required for the 4 recurring categories (one row per category per month). Null for ad hoc (other) expenses.';
