-- 0009_must_change_password.sql
-- Forces a password change after an owner/admin provisions an account with a
-- temporary password (see scripts/create-user.ts).

alter table profiles
  add column must_change_password boolean not null default true;

comment on column profiles.must_change_password is
  'True until the user sets their own password. Enforced in src/proxy.ts.';
