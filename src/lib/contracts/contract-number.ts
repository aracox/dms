import type { ContractRow } from '@/types/database';

/**
 * Display number for the "เลขที่สัญญา" field on the contract PDF. Derived
 * from the contract's own id and creation month rather than a new sequence
 * column -- unique and stable without a schema change.
 */
export function contractNumber(contract: Pick<ContractRow, 'id' | 'created_at'>): string {
  const yearMonth = contract.created_at.slice(0, 7).replace('-', '');
  return `${yearMonth}-${contract.id.slice(0, 8).toUpperCase()}`;
}
