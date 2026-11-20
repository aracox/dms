import 'server-only';

import { amountOwed } from '@/lib/billing/calc';
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
  /** What the tenant still owes on their own bills -- 0 once refunded. */
  owed: number;
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

  const pendingIds = pending.map((row) => row.id);
  const [rooms, tenants, invoices] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, room_type')
      .in('id', [...new Set(all.map((row) => row.room_id))]),
    supabase
      .from('tenants')
      .select('id, full_name, phone')
      .in('id', [...new Set(all.map((row) => row.tenant_id))]),
    // Waiting refunds show what the tenant still owes, so a full refund is
    // never given by accident against an unpaid bill.
    pendingIds.length
      ? supabase
          .from('invoices')
          .select('id, contract_id, status, total')
          .in('contract_id', pendingIds)
      : Promise.resolve({ data: [] }),
  ]);
  const invoiceIds = (invoices.data ?? []).map((invoice) => invoice.id);
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from('payments')
        .select('invoice_id, amount, status')
        .in('invoice_id', invoiceIds)
    : { data: [] };

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
      owed:
        status === 'pending'
          ? amountOwed(
              (invoices.data ?? [])
                .filter((invoice) => invoice.contract_id === contract.id)
                .map((invoice) => ({
                  ...invoice,
                  payments: (payments ?? []).filter((payment) => payment.invoice_id === invoice.id),
                })),
            )
          : 0,
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
