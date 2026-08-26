/**
 * Applies supabase/seed.sql.
 *
 * The seed is idempotent -- every id is derived from a stable key -- so running
 * it repeatedly neither duplicates nor overwrites.
 *
 *   npm run seed
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { connect } from './pg';

async function main() {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8');
  const client = await connect();

  try {
    // seed.sql manages its own begin/commit.
    await client.query(sql);

    const { rows } = await client.query<{
      total: string;
      real_rooms: string;
      test_rooms: string;
      cards: string;
      contracts: string;
      invoices: string;
    }>(`
      select
        (select count(*) from rooms)                        as total,
        (select count(*) from rooms where is_test = false)  as real_rooms,
        (select count(*) from rooms where is_test = true)   as test_rooms,
        (select count(*) from access_cards)                 as cards,
        (select count(*) from contracts)                    as contracts,
        (select count(*) from invoices)                     as invoices
    `);

    const counts = rows[0];
    if (!counts) throw new Error('Verification query returned no rows');

    console.log('Seeded:');
    console.log(
      `  rooms         ${counts.total}  (${counts.real_rooms} real + ${counts.test_rooms} test)`,
    );
    console.log(`  access cards  ${counts.cards}`);
    console.log(`  contracts     ${counts.contracts}`);
    console.log(`  invoices      ${counts.invoices}`);

    // The invariant the whole design protects: reports see 21, not 22.
    const { rows: reportRows } = await client.query<{
      total_rooms: number;
      occupancy_rate: string;
    }>('select total_rooms, occupancy_rate from report_room_summary');
    const report = reportRows[0];

    if (!report) throw new Error('report_room_summary returned no rows');

    console.log(`\nreport_room_summary.total_rooms = ${report.total_rooms} (must be 21)`);
    console.log(`report_room_summary.occupancy_rate = ${report.occupancy_rate}%`);

    if (Number(report.total_rooms) !== 21) {
      throw new Error(
        `Test data has leaked into reporting: report_room_summary.total_rooms is ` +
          `${report.total_rooms}, expected 21.`,
      );
    }

    if (Number(counts.real_rooms) !== 21) {
      throw new Error(`Expected 21 real rooms, found ${counts.real_rooms}.`);
    }

    console.log('\nTest-data exclusion verified.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
