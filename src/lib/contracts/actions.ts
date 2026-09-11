'use server';

import { revalidatePath } from 'next/cache';

import { round2 } from '@/lib/billing/money';
import { SUBSCRIPTION_FEE_KEYS, type SubscriptionFeeKey } from '@/lib/invoices/fees';
import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';
import {
  contractRentSchema,
  giveMoveOutNoticeSchema,
  renewContractSchema,
  settleDepositSchema,
} from '@/lib/validation/schemas';

export interface UpdateContractRentState {
  error: string | null;
}

/**
 * Corrects the active contract's monthly rent -- the value invoices are
 * generated from. Only affects invoices generated from now on: past invoices
 * already snapshotted their rent as an invoice_items row and are untouched.
 */
export async function updateContractRentAction(
  _previous: UpdateContractRentState,
  formData: FormData,
): Promise<UpdateContractRentState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = contractRentSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    monthly_rent: Number(formData.get('monthly_rent')),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('contracts')
    .update({ monthly_rent: parsed.data.monthly_rent })
    .eq('id', parsed.data.contract_id);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface RenewContractState {
  error: string | null;
}

/**
 * Ends the current contract and opens a new term for the same tenant --
 * see renew_contract() (0027). Subscriptions do not carry over: a new
 * term may come with different extras, so the owner re-picks them on the
 * new contract rather than inheriting the old one's silently.
 */
export async function renewContractAction(
  _previous: RenewContractState,
  formData: FormData,
): Promise<RenewContractState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = renewContractSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? ''),
    monthly_rent: Number(formData.get('monthly_rent')),
    deposit: Number(formData.get('deposit')),
    payment_due_day: Number(formData.get('payment_due_day')),
    occupant_count: Number(formData.get('occupant_count')),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('renew_contract', {
    p_contract_id: parsed.data.contract_id,
    p_start_date: parsed.data.start_date,
    p_end_date: parsed.data.end_date,
    p_monthly_rent: parsed.data.monthly_rent,
    p_deposit: parsed.data.deposit,
    p_payment_due_day: parsed.data.payment_due_day,
    p_occupant_count: parsed.data.occupant_count,
  });

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface SettleDepositState {
  error: string | null;
}

/**
 * Records how much of a terminated contract's deposit was withheld; the
 * rest is the refund. A separate step from move-out itself, since the
 * final figure often is not known (a damage check, the last utility bill)
 * until after the tenant has already left.
 */
export async function settleDepositAction(
  _previous: SettleDepositState,
  formData: FormData,
): Promise<SettleDepositState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = settleDepositSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    deduction: Number(formData.get('deduction')),
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('deposit, status')
    .eq('id', parsed.data.contract_id)
    .maybeSingle();

  if (!contract) return { error: 'errors.generic' };
  if (contract.status !== 'terminated') return { error: 'contract.notTerminated' };

  const refund = Math.max(0, round2(contract.deposit - parsed.data.deduction));

  const { error } = await supabase
    .from('contracts')
    .update({
      deposit_deduction: parsed.data.deduction,
      deposit_refund: refund,
      deposit_settled_at: bangkokToday(),
      deposit_settlement_note: parsed.data.note,
    })
    .eq('id', parsed.data.contract_id);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface GiveMoveOutNoticeState {
  error: string | null;
}

/**
 * Records that an active contract's tenant plans to leave early, on a date
 * that may be well before the lease's end_date. The contract stays active
 * and the room stays occupied -- this is only a heads-up so staff can start
 * lining up the next tenant. The daily process_due_move_out_notices sweep
 * (0032) runs the actual move-out once that date arrives; staff can still
 * move out earlier via move_out_room if needed.
 */
export async function giveMoveOutNoticeAction(
  _previous: GiveMoveOutNoticeState,
  formData: FormData,
): Promise<GiveMoveOutNoticeState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = giveMoveOutNoticeSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    planned_move_out_date: String(formData.get('planned_move_out_date') ?? ''),
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  if (parsed.data.planned_move_out_date < bangkokToday()) {
    return { error: 'validation.date.pastDate' };
  }

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('status')
    .eq('id', parsed.data.contract_id)
    .maybeSingle();

  if (!contract) return { error: 'errors.generic' };
  if (contract.status !== 'active') return { error: 'errors.generic' };

  const { error } = await supabase
    .from('contracts')
    .update({
      notice_given_at: bangkokToday(),
      planned_move_out_date: parsed.data.planned_move_out_date,
      notice_note: parsed.data.note,
    })
    .eq('id', parsed.data.contract_id);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface CancelMoveOutNoticeState {
  error: string | null;
}

/** Clears a notice -- the tenant changed their mind and is staying. */
export async function cancelMoveOutNoticeAction(
  _previous: CancelMoveOutNoticeState,
  formData: FormData,
): Promise<CancelMoveOutNoticeState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const contractId = String(formData.get('contract_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase
    .from('contracts')
    .update({ notice_given_at: null, planned_move_out_date: null, notice_note: null })
    .eq('id', contractId);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}

export interface UpdateSubscriptionsState {
  error: string | null;
}

/**
 * Replaces the contract's whole subscription set with whatever came in on
 * this submit. A full delete-then-insert rather than a diff -- at most 9
 * rows, so there is no cost to keeping this simple.
 */
export async function updateContractSubscriptionsAction(
  _previous: UpdateSubscriptionsState,
  formData: FormData,
): Promise<UpdateSubscriptionsState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const contractId = String(formData.get('contract_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');

  const validKeys: readonly string[] = SUBSCRIPTION_FEE_KEYS;
  const selected = formData
    .getAll('subscription')
    .map(String)
    .filter((key): key is SubscriptionFeeKey => validKeys.includes(key));

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from('contract_subscriptions')
    .delete()
    .eq('contract_id', contractId);
  if (deleteError) return { error: 'errors.generic' };

  if (selected.length > 0) {
    const { error: insertError } = await supabase
      .from('contract_subscriptions')
      .insert(selected.map((fee_key) => ({ contract_id: contractId, fee_key })));
    if (insertError) return { error: 'errors.generic' };
  }

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}
