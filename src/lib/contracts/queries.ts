import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { ContractRow, RoomType } from '@/types/database';

import { pendingDepositSettlement } from './status';

export interface DepositRefundRecord {
  contract: ContractRow;
  roomNumber: string;
  roomType: RoomType;
  tenantName: string;
  tenantPhone: string;
  /** 'pending' until deposit_settled_at is set. */
  status: 'pending' | 'refunded';
}

/**
 * Every deposit refund, waiting or done: each room's pending settlement (same
 * rule as the room's Contract tab) plus every contract already settled.
 * Waiting ones come first, oldest move-out first; then settled ones, most
 * recent first. An operational list, so it reads base tables; the T01 test
 * room is excluded.
 */
export async function getDepositRefunds(): Promise<DepositRefundRecord[]> {
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('is_test', false)
    .order('start_date', { ascending: false });

  const byRoom = new Map<string, ContractRow[]>();
  for (const row of contracts ?? []) {
    byRoom.set(row.room_id, [...(byRoom.get(row.room_id) ?? []), row]);
  }
  const pending = [...byRoom.values()]
    .map((roomContracts) => pendingDepositSettlement(roomContracts))
    .filter((row): row is ContractRow => row !== null);
  const settled = (contracts ?? []).filter((row) => row.deposit_settled_at !== null);

  const all = [...pending, ...settled];
  if (all.length === 0) return [];

  const [rooms, tenants] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, room_type')
      .in('id', [...new Set(all.map((row) => row.room_id))]),
    supabase
      .from('tenants')
      .select('id, full_name, phone')
      .in('id', [...new Set(all.map((row) => row.tenant_id))]),
  ]);

  const toRecord = (
    contract: ContractRow,
    status: DepositRefundRecord['status'],
  ): DepositRefundRecord => {
    const room = rooms.data?.find((row) => row.id === contract.room_id);
    const tenant = tenants.data?.find((row) => row.id === contract.tenant_id);
    return {
      contract,
      roomNumber: room?.room_number ?? '',
      roomType: room?.room_type ?? 'standard',
      tenantName: tenant?.full_name ?? '',
      tenantPhone: tenant?.phone ?? '',
      status,
    };
  };
  const movedOut = (row: ContractRow) => row.terminated_at ?? row.end_date;

  return [
    ...pending
      .sort((a, b) => movedOut(a).localeCompare(movedOut(b)))
      .map((row) => toRecord(row, 'pending')),
    ...settled
      .sort((a, b) => (b.deposit_settled_at ?? '').localeCompare(a.deposit_settled_at ?? ''))
      .map((row) => toRecord(row, 'refunded')),
  ];
}
