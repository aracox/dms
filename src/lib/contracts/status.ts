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
