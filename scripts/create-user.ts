/**
 * Creates a Supabase auth user and sets its application role.
 *
 *   $env:NEW_USER_PASSWORD = "your-password"
 *   npm run create-user -- aracox@gmail.com owner
 *
 * The password comes from the NEW_USER_PASSWORD environment variable rather
 * than an argument, so it does not land in shell history. It is never written
 * to a file and never committed.
 *
 * Uses auth.admin.createUser, which is the only correct way to create a user:
 * Supabase owns the password hashing. Inserting into auth.users by hand
 * produces an account that cannot log in.
 *
 * email_confirm: true marks the address confirmed without sending any email.
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

const ROLES = ['owner', 'admin', 'staff'] as const;
type Role = (typeof ROLES)[number];

/** Supabase rejects anything shorter than 6 by default. */
const SUPABASE_MIN_PASSWORD_LENGTH = 6;

function usage(message: string): never {
  console.error(`${message}

Usage:
  $env:NEW_USER_PASSWORD = "your-password"
  npm run create-user -- <email> <${ROLES.join('|')}>

Example:
  npm run create-user -- owner@example.com owner`);
  process.exit(1);
}

async function main() {
  const [email, role] = process.argv.slice(2);
  const password = process.env.NEW_USER_PASSWORD;

  if (!email || !email.includes('@')) usage('A valid email address is required.');
  if (!role || !ROLES.includes(role as Role)) usage(`Role must be one of: ${ROLES.join(', ')}`);
  if (!password) usage('Set NEW_USER_PASSWORD before running this.');

  if (password.length < SUPABASE_MIN_PASSWORD_LENGTH) {
    usage(
      `Password is ${password.length} characters. Supabase requires at least ` +
        `${SUPABASE_MIN_PASSWORD_LENGTH}, so this would be rejected by the API.`,
    );
  }

  if (role === 'owner' && password.length < 12) {
    console.warn(
      `Warning: ${password.length}-character password on an owner account, which can read ` +
        `tenant identity documents and delete payment records. Consider something longer.\n`,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    usage('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.');
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error(`Could not create the user: ${error?.message ?? 'unknown error'}`);
    process.exit(1);
  }

  console.log(`Created auth user ${email} (${data.user.id})`);

  // The handle_new_user trigger has already inserted a profiles row at 'staff';
  // this promotes it. Done separately so a role change to an existing user works
  // through the same path.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role, full_name: email.split('@')[0] ?? '' })
    .eq('id', data.user.id);

  if (profileError) {
    console.error(
      `User was created but the role could not be set: ${profileError.message}\n` +
        `Fix it with:\n  npm run sql -- "update profiles set role = '${role}' ` +
        `where id = '${data.user.id}'"`,
    );
    process.exit(1);
  }

  console.log(`Set role to '${role}'. You can now sign in at /th/login.`);
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
