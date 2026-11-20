import { addDays } from '@/lib/utils/date';
import type { ContractRow, ContractStatus } from '@/types/database';

export type ContractDisplayStatus = ContractStatus | 'awaiting_refund';

/**
 * A terminated contract still needs its own label until the deposit is
 * settled -- otherwise a move-out that's fully wrapped up and one still
 * waiting on a refund decision look identical everywhere contract status is
 * shown. Every other status displays as-is.
 */
export function contractDisplayStatus(
  contract: Pick<ContractRow, 'status' | 'deposit_settled_at'>,
): ContractDisplayStatus {
  if (contract.status === 'terminated' && !contract.deposit_settled_at) {
    return 'awaiting_refund';
  }
  return contract.status;
}

/**
 * The past contract whose deposit still has to be settled, if any, given one
 * room's contracts newest first. Shared by the room's Contract tab and the
 * pending-refunds page so the two can never disagree.
 *
 * Only the room's single most recent past contract counts -- an older one
 * left unsettled from before settlement existed should not resurface, and a
 * contract that ended via renewal (status 'expired') was never actually
 * vacated, so it never needs a refund.
 */
export function pendingDepositSettlement<
  T extends Pick<ContractRow, 'status' | 'deposit_settled_at'>,
>(roomContractsNewestFirst: readonly T[]): T | null {
  const mostRecentPast = roomContractsNewestFirst.find((row) => row.status !== 'active');
  return mostRecentPast && contractDisplayStatus(mostRecentPast) === 'awaiting_refund'
    ? mostRecentPast
    : null;
}

type BillableContract = Pick<ContractRow, 'status' | 'start_date' | 'end_date' | 'terminated_at'>;

/**
 * A contract's last billable day, or null while it runs on (an active
 * contract past its end_date is still running). A terminated contract ends on
 * its termination date. A renewed one ('expired') ends on its end_date -- or
 * the day before the contract that replaced it starts, if that is earlier:
 * renewal does not shorten the old contract, and an early renewal must not
 * bill the overlap twice. `newer` is the room's next contract, if any.
 */
export function contractEndedOn(
  contract: BillableContract,
  newer?: Pick<ContractRow, 'start_date'>,
): string | null {
  if (contract.status === 'terminated') return contract.terminated_at;
  if (contract.status !== 'expired') return null;
  if (!newer) return contract.end_date;
  const dayBeforeNewer = addDays(newer.start_date, -1);
  return dayBeforeNewer < contract.end_date ? dayBeforeNewer : contract.end_date;
}

/**
 * Every contract a room bills for `billingMonth`, given that room's contracts
 * newest first: each covers the months from its start through the month it
 * ended, so a tenant who moved out on the 20th still owes that month and the
 * one who moved in on the 21st owes it too -- one bill each. Drafts never
 * bill. The first one returned is the tenant in the room at month end, whose
 * bill carries that month's meter readings.
 */
export function contractsForBillingMonth<T extends BillableContract>(
  roomContractsNewestFirst: readonly T[],
  billingMonth: string,
): T[] {
  const month = billingMonth.slice(0, 7);
  return roomContractsNewestFirst.filter((contract, index) => {
    if (contract.status === 'draft') return false;
    if (contract.start_date.slice(0, 7) > month) return false;
    if (contract.status === 'active') return true;
    const endedOn = contractEndedOn(contract, roomContractsNewestFirst[index - 1]);
    // An end before the start: a renewal on the contract's first day.
    return endedOn !== null && endedOn >= contract.start_date && endedOn.slice(0, 7) >= month;
  });
}

/** The contracts in `billingMonth` that have no live (non-cancelled) bill yet. */
export function unbilledContracts<T extends BillableContract & Pick<ContractRow, 'id'>>(
  roomContractsNewestFirst: readonly T[],
  liveInvoices: readonly { contract_id: string | null; billing_month: string }[],
  billingMonth: string,
): T[] {
  return contractsForBillingMonth(roomContractsNewestFirst, billingMonth).filter(
    (contract) =>
      !liveInvoices.some(
        (invoice) => invoice.contract_id === contract.id && invoice.billing_month === billingMonth,
      ),
  );
}
