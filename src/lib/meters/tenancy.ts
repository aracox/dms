import { addDays, addMonths, billingMonthOf, type IsoDate } from '@/lib/utils/date';
import type { ContractRow, MeterReadingRow } from '@/types/database';

export type UtilityMeter = 'electricity' | 'water';

type Reading = Pick<MeterReadingRow, 'billing_month' | 'meter_type' | 'current_reading'>;
export type MeterContract = Pick<
  ContractRow,
  | 'id'
  | 'status'
  | 'start_date'
  | 'terminated_at'
  | 'meter_start_electricity'
  | 'meter_start_water'
  | 'meter_end_electricity'
  | 'meter_end_water'
>;

const startNumber = (contract: MeterContract, type: UtilityMeter) =>
  type === 'electricity' ? contract.meter_start_electricity : contract.meter_start_water;

const endNumber = (contract: MeterContract, type: UtilityMeter) =>
  type === 'electricity' ? contract.meter_end_electricity : contract.meter_end_water;

const lastDayOf = (billingMonth: IsoDate) => addDays(addMonths(billingMonth, 1), -1);

/**
 * The meter's last known number as of `through` (inclusive). Three things
 * record it: a month's reading (taken at month end), a tenant's move-in
 * number, and a tenant's move-out number. The latest wins; on the same day a
 * move-out comes before a move-in, and both before the month-end reading.
 *
 * A month's own reading only counts for dates after that month -- a reading
 * is taken at month end, so on the month's last day it is not yet "before".
 * `excludeEndOf` leaves out one contract's move-out number: the one whose
 * usage is being worked out.
 *
 * Null when nothing is known, so the caller asks rather than assuming 0.
 */
export function lastMeterNumber({
  type,
  readings,
  contracts,
  through,
  excludeEndOf,
}: {
  type: UtilityMeter;
  readings: readonly Reading[];
  contracts: readonly MeterContract[];
  through: IsoDate;
  excludeEndOf?: string;
}): number | null {
  const events: { date: IsoDate; order: number; value: number }[] = [];

  for (const reading of readings) {
    const takenOn = lastDayOf(reading.billing_month);
    if (reading.meter_type === type && takenOn < through) {
      events.push({ date: takenOn, order: 2, value: reading.current_reading });
    }
  }
  for (const contract of contracts) {
    const start = startNumber(contract, type);
    if (start !== null && contract.status !== 'draft' && contract.start_date <= through) {
      events.push({ date: contract.start_date, order: 1, value: start });
    }
    const end = endNumber(contract, type);
    if (
      end !== null &&
      contract.id !== excludeEndOf &&
      contract.terminated_at &&
      contract.terminated_at <= through
    ) {
      events.push({ date: contract.terminated_at, order: 0, value: end });
    }
  }

  const latest = events.sort((a, b) =>
    a.date === b.date ? b.order - a.order : a.date < b.date ? 1 : -1,
  )[0];
  return latest?.value ?? null;
}

/** Whether `contract` left during `billingMonth` with a final `type` meter number. */
export function hasFinalMeterNumber(
  contract: MeterContract,
  type: UtilityMeter,
  billingMonth: IsoDate,
): boolean {
  return (
    contract.status === 'terminated' &&
    contract.terminated_at !== null &&
    billingMonthOf(contract.terminated_at) === billingMonth &&
    endNumber(contract, type) !== null
  );
}

/**
 * What a tenant who moved out during `billingMonth` used on one meter: from
 * the last known number before they left to the final number recorded at
 * move-out. It goes on their last bill, and the month's own reading then
 * never does (see hasFinalMeterNumber). Undefined when there is nothing to
 * bill: no final number, or no known number to count from.
 */
export function finalMeterUsage({
  contract,
  type,
  billingMonth,
  readings,
  contracts,
}: {
  contract: MeterContract;
  type: UtilityMeter;
  billingMonth: IsoDate;
  readings: readonly Reading[];
  contracts: readonly MeterContract[];
}): { previousReading: number; currentReading: number } | undefined {
  if (!hasFinalMeterNumber(contract, type, billingMonth)) return undefined;
  const currentReading = endNumber(contract, type)!;
  const previousReading = lastMeterNumber({
    type,
    readings,
    contracts,
    through: contract.terminated_at!,
    excludeEndOf: contract.id,
  });
  if (previousReading === null || currentReading < previousReading) return undefined;
  return { previousReading, currentReading };
}

/** The invoice line note for a move-out usage, e.g. "1,200 → 1,260 (20/11)". */
export function finalMeterLabel(
  usage: { previousReading: number; currentReading: number },
  movedOutOn: IsoDate,
): string {
  const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const day = `${Number(movedOutOn.slice(8, 10))}/${Number(movedOutOn.slice(5, 7))}`;
  return `${number(usage.previousReading)} → ${number(usage.currentReading)} (${day})`;
}
