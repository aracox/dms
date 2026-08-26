/**
 * Applies supabase/migrations/*.sql in filename order.
 *
 * Tracks what has run in a `schema_migrations` table, so re-running is safe and
 * only new files are applied. Each file runs in its own transaction.
 *
 *   npm run db:push
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { connect, runInTransaction } from './pg';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  const client = await connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      'select filename from schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.filename));

    let count = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  apply ${file} ... `);

      await runInTransaction(
        client,
        `${sql}\ninsert into schema_migrations (filename) values ('${file}');`,
        file,
      );

      console.log('ok');
      count += 1;
    }

    console.log(
      count === 0
        ? '\nSchema already up to date.'
        : `\nApplied ${count} migration${count === 1 ? '' : 's'}. Next: npm run seed`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
