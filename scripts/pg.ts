/**
 * Direct PostgreSQL access for migrations and seeding.
 *
 * Uses the standard `pg` driver against SUPABASE_DB_URL rather than the Supabase
 * CLI: the CLI is a large install, and this needs no tooling beyond npm. Both
 * scripts are developer-only -- nothing here is imported by the application.
 */

import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

export function requireDatabaseUrl(): string {
  const url = process.env.SUPABASE_DB_URL;

  if (!url) {
    throw new Error(
      'SUPABASE_DB_URL is not set.\n\n' +
        'Copy .env.example to .env.local, then fill it from:\n' +
        '  Supabase dashboard -> Project Settings -> Database -> Connection string (URI)\n\n' +
        'If your network blocks port 5432, use the pooler URI on port 6543.',
    );
  }

  return url;
}

/** Opens a connection with TLS, as Supabase requires. */
export async function connect(): Promise<Client> {
  const client = new Client({
    connectionString: requireDatabaseUrl(),
    // Supabase presents a certificate chain Node does not bundle a root for.
    // The connection is still encrypted; only chain verification is relaxed.
    ssl: { rejectUnauthorized: false },
    // Migrations can involve large DDL batches.
    statement_timeout: 120_000,
  });

  await client.connect();
  return client;
}

/** Runs SQL inside a transaction, rolling back on any error. */
export async function runInTransaction(client: Client, sql: string, label: string): Promise<void> {
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw new Error(`${label} failed:\n${(error as Error).message}`);
  }
}
