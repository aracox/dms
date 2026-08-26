/**
 * Ad-hoc SQL against the configured Supabase database, for inspection during
 * development.
 *
 *   npm run sql -- "select room_number, status from rooms order by room_number"
 *   npm run sql -- "select * from report_room_summary"
 *
 * Uses SUPABASE_DB_URL, so it bypasses RLS entirely -- it is a developer tool,
 * not part of the application. Read-only by convention, not by enforcement:
 * whatever you type is what runs.
 */

import { connect } from './pg';

async function main() {
  const query = process.argv.slice(2).join(' ').trim();

  if (!query) {
    console.error('Usage: npm run sql -- "select ... from ..."');
    process.exit(1);
  }

  const client = await connect();

  try {
    const result = await client.query(query);

    if (!result.rows || result.rows.length === 0) {
      // rowCount is null for statements that return no result set at all.
      console.log(result.rowCount === null ? 'OK (no result set)' : '0 rows');
      return;
    }

    console.table(result.rows);
    console.log(`${result.rows.length} row${result.rows.length === 1 ? '' : 's'}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
