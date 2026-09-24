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
