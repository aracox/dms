'use server';

import { revalidatePath } from 'next/cache';

import { subtractMoney } from '@/lib/billing/money';
import { SUBSCRIPTION_FEE_KEYS, type SubscriptionFeeKey } from '@/lib/invoices/fees';
import { refreshContractBills } from '@/lib/invoices/refresh';
import { finalMeterError } from '@/lib/meters/final';
import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';
import {
  contractOccupantsSchema,
  contractPeriodSchema,
  contractRentSchema,
  giveMoveOutNoticeSchema,
  recordDepositReceivedSchema,
  recordFinalMeterSchema,
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

export interface RecordDepositReceivedState {
  error: string | null;
}

/**
 * Records that an active contract's deposit has been paid, today -- for a
 * tenant who paid after moving in, or a contract from before move-in
 * recorded it. Held money, not income: nothing here touches payments.
 */
export async function recordDepositReceivedAction(
  _previous: RecordDepositReceivedState,
  formData: FormData,
): Promise<RecordDepositReceivedState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = recordDepositReceivedSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    method: String(formData.get('method') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('contracts')
    .update({ deposit_received_on: bangkokToday(), deposit_received_method: parsed.data.method })
    .eq('id', parsed.data.contract_id)
    .eq('status', 'active')
    .is('deposit_received_on', null);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  revalidatePath('/dashboard');
  return { error: null };
}

export interface RecordFinalMeterState {
  error: string | null;
}

/**
 * Records the final meter numbers of a tenant who moved out without them --
 * the daily sweep moves a tenant out on their notice date with nobody there
 * to read the meters. Then re-prices their last bill with the usage up to
 * move-out day, exactly as a move-out with numbers would have.
 */
export async function recordFinalMeterAction(
  _previous: RecordFinalMeterState,
  formData: FormData,
): Promise<RecordFinalMeterState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const meterField = (name: string) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw === '' ? Number.NaN : Number(raw);
  };
  const parsed = recordFinalMeterSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    meter_end_electricity: meterField('meter_end_electricity'),
    meter_end_water: meterField('meter_end_water'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, room_id, status, terminated_at, meter_end_electricity, meter_end_water')
    .eq('id', parsed.data.contract_id)
    .maybeSingle();

  if (
    !contract?.terminated_at ||
    contract.status !== 'terminated' ||
    contract.meter_end_electricity !== null ||
    contract.meter_end_water !== null
  ) {
    return { error: 'errors.generic' };
  }

  const meterError = await finalMeterError(supabase, {
    roomId: contract.room_id,
    contractId: contract.id,
    movedOutOn: contract.terminated_at,
    electricity: parsed.data.meter_end_electricity,
    water: parsed.data.meter_end_water,
  });
  if (meterError) return { error: meterError };

  const { error } = await supabase
    .from('contracts')
    .update({
      meter_end_electricity: parsed.data.meter_end_electricity,
      meter_end_water: parsed.data.meter_end_water,
    })
    .eq('id', contract.id)
    .is('meter_end_electricity', null)
    .is('meter_end_water', null);

  if (error) return { error: 'errors.generic' };

  const refreshed = await refreshContractBills(supabase, contract.id);
  if (refreshed.error) return { error: refreshed.error };

  revalidatePath(`/rooms/${contract.room_id}`);
  revalidatePath('/billing');
  return { error: null };
}

export interface UpdateContractOccupantsState {
  error: string | null;
}

/**
 * Corrects the active contract's headcount. Still just a number -- no personal
 * data is stored for the occupants beyond the main tenant.
 */
export async function updateContractOccupantsAction(
  _previous: UpdateContractOccupantsState,
  formData: FormData,
): Promise<UpdateContractOccupantsState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = contractOccupantsSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    occupant_count: Number(formData.get('occupant_count')),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('contracts')
    .update({ occupant_count: parsed.data.occupant_count })
    .eq('id', parsed.data.contract_id);

  if (error) return { error: 'errors.generic' };

  // The headcount also shows on the room list and floor plan.
  if (roomId) revalidatePath(`/rooms/${roomId}`);
  revalidatePath('/rooms');
  revalidatePath('/floor-plan');
  return { error: null };
}

export interface UpdateContractPeriodState {
  error: string | null;
  /** Which date input the error belongs to, so the form can mark it. */
  field?: 'start_date' | 'end_date';
}

/**
 * Corrects the active contract's start/end dates. Reports, the floor plan and
 * the "contract expiring" LINE reminder all read these live, so nothing else
 * needs recomputing. Extending a lease into a new term is renewContractAction.
 */
export async function updateContractPeriodAction(
  _previous: UpdateContractPeriodState,
  formData: FormData,
): Promise<UpdateContractPeriodState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = contractPeriodSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? ''),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.at(-1);
    return {
      error: issue?.message ?? 'errors.generic',
      field: field === 'start_date' || field === 'end_date' ? field : undefined,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('contracts')
    .update({ start_date: parsed.data.start_date, end_date: parsed.data.end_date })
    .eq('id', parsed.data.contract_id);

  if (error) return { error: 'errors.generic' };

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  revalidatePath('/rooms');
  revalidatePath('/floor-plan');
  revalidatePath('/dashboard');
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
  /** Which input the error belongs to, so the form can mark it. */
  field?: 'refund' | 'reason';
}

/**
 * Records how much of a terminated contract's deposit was actually handed
 * back. Staff enter the refund; the deduction is deposit - refund, derived
 * here rather than trusted from the browser. Any deduction needs a reason
 * -- it is what the tenant will ask about. A separate step from move-out
 * itself, since the final figure often is not known (a damage check, the
 * last utility bill) until after the tenant has already left.
 */
/** The errors settle_deposit (0045) raises by translation key, and the field each belongs to. */
const SETTLE_DEPOSIT_ERRORS: Record<string, { field?: 'refund' }> = {
  'contract.notTerminated': {},
  'contract.alreadySettled': {},
  'contract.refundExceedsDeposit': { field: 'refund' },
  'contract.deductionBelowOwed': { field: 'refund' },
};

export async function settleDepositAction(
  _previous: SettleDepositState,
  formData: FormData,
): Promise<SettleDepositState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'contracts:write');

  const roomId = String(formData.get('room_id') ?? '');

  const parsed = settleDepositSchema.safeParse({
    contract_id: String(formData.get('contract_id') ?? ''),
    refund: Number(formData.get('refund')),
    reason: String(formData.get('reason') ?? '').trim() || null,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.message ?? 'errors.generic',
      field: issue?.path[0] === 'reason' ? 'reason' : 'refund',
    };
  }

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('deposit, status')
    .eq('id', parsed.data.contract_id)
    .maybeSingle();

  if (!contract) return { error: 'errors.generic' };
  if (contract.status !== 'terminated') return { error: 'contract.notTerminated' };
  if (parsed.data.refund > contract.deposit) {
    return { error: 'contract.refundExceedsDeposit', field: 'refund' };
  }

  const deduction = subtractMoney(contract.deposit, parsed.data.refund);
  if (deduction > 0 && !parsed.data.reason) {
    return { error: 'contract.deductionReasonRequired', field: 'reason' };
  }

  // One transaction: the settlement and, if asked, paying the tenant's unpaid
  // bills from the deposit (payment method 'deposit').
  const { error } = await supabase.rpc('settle_deposit', {
    p_contract_id: parsed.data.contract_id,
    p_refund: parsed.data.refund,
    p_reason: parsed.data.reason ?? null,
    p_pay_bills: formData.get('pay_bills') === 'on',
  });

  if (error) {
    // settle_deposit raises translation keys for the cases staff can fix.
    const known = SETTLE_DEPOSIT_ERRORS[error.message];
    return known ? { error: error.message, field: known.field } : { error: 'errors.generic' };
  }

  if (roomId) revalidatePath(`/rooms/${roomId}`);
  revalidatePath('/refunds');
  revalidatePath('/payments');
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
