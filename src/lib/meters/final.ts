import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { IsoDate } from '@/lib/utils/date';
import type { Database } from '@/types/database';

import { lastMeterNumber } from './tenancy';

/**
 * Checks a move-out's final meter numbers against the last known ones as of
 * the move-out day: a final number below it is a typo, and would bill
 * nothing. Returns the error key for the first meter that fails, or null.
 * `contractId` is the contract moving out -- its own (empty) final number is
 * not "known" yet.
 */
export async function finalMeterError(
  supabase: SupabaseClient<Database>,
  {
    roomId,
    contractId,
    movedOutOn,
    electricity,
    water,
  }: {
    roomId: string;
    contractId: string;
    movedOutOn: IsoDate;
    electricity: number;
    water: number;
  },
): Promise<string | null> {
  const [{ data: readings }, { data: contracts }] = await Promise.all([
    supabase
      .from('meter_readings')
      .select('billing_month, meter_type, current_reading')
      .eq('room_id', roomId)
      .order('billing_month', { ascending: false })
      .limit(24),
    supabase
      .from('contracts')
      .select(
        'id, status, start_date, terminated_at, meter_start_electricity, meter_start_water, meter_end_electricity, meter_end_water',
      )
      .eq('room_id', roomId),
  ]);

  for (const [type, final] of [
    ['electricity', electricity],
    ['water', water],
  ] as const) {
    const last = lastMeterNumber({
      type,
      readings: readings ?? [],
      contracts: contracts ?? [],
      through: movedOutOn,
      excludeEndOf: contractId,
    });
    if (last !== null && final < last) return `contract.meterBelowLast.${type}`;
  }
  return null;
}
