-- 0022_common_expenses_internet_transformer.sql
-- Adds two more recurring monthly common-expense categories: internet and
-- the transformer (หม้อแปลง) fee. Both behave like the existing 4 monthly
-- categories -- one row per category per month, billing_month required
-- (enforced already by common_expenses_billing_month_ck, which keys off
-- category <> 'other').

alter type common_expense_category add value 'internet';
alter type common_expense_category add value 'transformer_fee';
