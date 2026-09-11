-- 0028_deposit_settlement.sql
-- Deposit refund settlement at move-out: how much of the deposit was
-- withheld and why, and how much was actually given back. Recorded as a
-- separate step after move_out_room() (0018) terminates the contract,
-- since the final figure often is not known until the last utility bill
-- or a damage check happens, sometimes days after the tenant has left.

alter table contracts
  add column deposit_deduction numeric(12, 2) not null default 0 check (deposit_deduction >= 0),
  add column deposit_refund numeric(12, 2) check (deposit_refund is null or deposit_refund >= 0),
  add column deposit_settled_at date,
  add column deposit_settlement_note text;

comment on column contracts.deposit_refund is
  'Null until settled. deposit - deposit_deduction, clamped to 0 if deductions exceed the deposit.';
comment on column contracts.deposit_settled_at is
  'Set once the refund is recorded. Null means still pending, independent of contract status.';

alter table contracts
  add constraint contracts_deposit_settlement_consistency_ck check (
    (deposit_settled_at is not null and deposit_refund is not null)
    or (deposit_settled_at is null and deposit_refund is null)
  );
