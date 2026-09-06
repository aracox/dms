/**
 * Replaces development/demo business data with supabase/seed.sql.
 *
 * This is intentionally destructive, so it requires an explicit reset flag.
 * Auth users and profiles are preserved by the SQL.
 *
 *   npm run seed -- --reset
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { connect } from './pg';

async function main() {
  if (!process.argv.includes('--reset')) {
    throw new Error(
      'Seeding replaces all application business data.\n' +
        'Run `npm run seed -- --reset` to confirm the reset.',
    );
  }

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
      meter_readings: string;
      payments: string;
      common_expenses: string;
    }>(`
      select
        (select count(*) from rooms)                        as total,
        (select count(*) from rooms where is_test = false)  as real_rooms,
        (select count(*) from rooms where is_test = true)   as test_rooms,
        (select count(*) from access_cards)                 as cards,
        (select count(*) from contracts)                    as contracts,
        (select count(*) from invoices)                     as invoices,
        (select count(*) from meter_readings)               as meter_readings,
        (select count(*) from payments)                     as payments,
        (select count(*) from common_expenses)              as common_expenses
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
    console.log(`  meter readings ${counts.meter_readings}`);
    console.log(`  payments      ${counts.payments}`);
    console.log(`  common expenses ${counts.common_expenses}`);

    // The invariant the whole design protects: reports see 24, not 25, and
    // current occupancy is at least 80%.
    const { rows: reportRows } = await client.query<{
      total_rooms: number;
      occupancy_rate: string;
    }>('select total_rooms, occupancy_rate from report_room_summary');
    const report = reportRows[0];

    if (!report) throw new Error('report_room_summary returned no rows');

    console.log(`\nreport_room_summary.total_rooms = ${report.total_rooms} (must be 24)`);
    console.log(`report_room_summary.occupancy_rate = ${report.occupancy_rate}%`);

    if (Number(report.total_rooms) !== 24) {
      throw new Error(
        `Test data has leaked into reporting: report_room_summary.total_rooms is ` +
          `${report.total_rooms}, expected 24.`,
      );
    }

    if (Number(counts.real_rooms) !== 24) {
      throw new Error(`Expected 24 real rooms, found ${counts.real_rooms}.`);
    }

    if (Number(report.occupancy_rate) < 80) {
      throw new Error(`Current occupancy is ${report.occupancy_rate}%, expected at least 80%.`);
    }

    const { rows: rentRows } = await client.query<{
      room_mismatches: string;
      contract_mismatches: string;
      invoice_mismatches: string;
    }>(`
      select
        (select count(*) from rooms where monthly_rent <> 3500) as room_mismatches,
        (select count(*) from contracts where monthly_rent <> 3500) as contract_mismatches,
        (
          select count(*)
          from invoice_items
          where type = 'rent' and (quantity <> 1 or unit_price <> 3500)
        ) as invoice_mismatches
    `);
    const rent = rentRows[0];

    if (!rent) throw new Error('Rent verification returned no rows.');

    const rentMismatches =
      Number(rent.room_mismatches) +
      Number(rent.contract_mismatches) +
      Number(rent.invoice_mismatches);

    if (rentMismatches !== 0) {
      throw new Error(
        `Rent must be 3,500 THB everywhere: ` +
          `${rent.room_mismatches} rooms, ${rent.contract_mismatches} contracts, and ` +
          `${rent.invoice_mismatches} invoice items differ.`,
      );
    }

    const { rows: monthlyRows } = await client.query<{
      billing_month: string;
      occupied_rooms: string;
      occupancy_rate: string;
      invoice_count: string;
      meter_count: string;
    }>(`
      with months as (
        select month_start::date as billing_month
        from generate_series(
          date '2025-01-01',
          date_trunc('month', bangkok_today())::date,
          interval '1 month'
        ) as month_start
      ),
      real_room_count as (
        select count(*)::numeric as total from rooms where is_test = false
      )
      select
        to_char(m.billing_month, 'YYYY-MM-DD') as billing_month,
        count(distinct c.room_id)::text as occupied_rooms,
        round(count(distinct c.room_id)::numeric * 100 / rrc.total, 1)::text as occupancy_rate,
        count(distinct i.id)::text as invoice_count,
        count(distinct mr.id)::text as meter_count
      from months m
      cross join real_room_count rrc
      left join contracts c
        on c.is_test = false
       and c.status <> 'draft'
       and c.start_date <= (m.billing_month + interval '1 month - 1 day')::date
       and coalesce(c.terminated_at, c.end_date) >= m.billing_month
      left join invoices i
        on i.is_test = false
       and i.billing_month = m.billing_month
       and i.status <> 'cancelled'
      left join meter_readings mr
        on mr.is_test = false
       and mr.billing_month = m.billing_month
      group by m.billing_month, rrc.total
      order by m.billing_month
    `);

    if (monthlyRows.length === 0 || monthlyRows[0]?.billing_month !== '2025-01-01') {
      throw new Error('Monthly history must start on 2025-01-01.');
    }

    for (const month of monthlyRows) {
      if (Number(month.occupancy_rate) < 80) {
        throw new Error(
          `${month.billing_month} occupancy is ${month.occupancy_rate}%, expected at least 80%.`,
        );
      }
      const occupiedRooms = Number(month.occupied_rooms);
      if (
        Number(month.invoice_count) !== occupiedRooms ||
        Number(month.meter_count) !== occupiedRooms * 2
      ) {
        throw new Error(
          `${month.billing_month} is incomplete: ${month.invoice_count} invoices and ` +
            `${month.meter_count} meter readings for ${month.occupied_rooms} occupied rooms.`,
        );
      }
    }

    const occupancyLevels = new Set(monthlyRows.map((month) => month.occupied_rooms));
    if (occupancyLevels.size < 2) {
      throw new Error('Monthly occupancy must vary across the seeded timeline.');
    }

    console.log('\nVerified:');
    console.log('  all room, contract, and rent invoice values are 3,500 THB');
    console.log(
      `  ${monthlyRows.length} months from 2025-01 through ${monthlyRows.at(-1)?.billing_month.slice(0, 7)}`,
    );
    console.log('  monthly occupancy varies from 20-24 rooms (83.3%-100%)');
    console.log('  every occupied room has one invoice and two meter readings per month');
    console.log('  T01 remains excluded from all reporting');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
