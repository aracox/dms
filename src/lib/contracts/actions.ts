'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { contractRentSchema } from '@/lib/validation/schemas';

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
