'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { adHocCommonExpenseSchema, monthlyCommonExpenseSchema } from '@/lib/validation/schemas';

export interface SaveCommonExpenseState {
  error: string | null;
}

/**
 * Records or corrects one recurring category's amount for one month. Insert
 * vs. update is decided the same way meter readings are: look up the
 * existing row for (category, billing_month) first.
 */
export async function saveMonthlyExpenseAction(
  _previous: SaveCommonExpenseState,
  formData: FormData,
): Promise<SaveCommonExpenseState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'expenses:write');

  const parsed = monthlyCommonExpenseSchema.safeParse({
    category: String(formData.get('category') ?? ''),
    description: String(formData.get('description') ?? '').trim() || null,
    amount: Number(formData.get('amount')),
    billing_month: String(formData.get('billing_month') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('common_expenses')
    .select('id')
    .eq('category', parsed.data.category)
    .eq('billing_month', parsed.data.billing_month)
    .maybeSingle();

  const payload = {
    category: parsed.data.category,
    description: parsed.data.description ?? null,
    amount: parsed.data.amount,
    billing_month: parsed.data.billing_month,
    expense_date: parsed.data.billing_month,
  };

  const { error } = existing
    ? await supabase.from('common_expenses').update(payload).eq('id', existing.id)
    : await supabase.from('common_expenses').insert({ ...payload, recorded_by: profile!.id });

  if (error) return { error: 'errors.generic' };

  revalidatePath('/expenses');
  return { error: null };
}

/** Creates or updates (via expense_id) a one-off, freely-dated expense. */
export async function saveAdHocExpenseAction(
  _previous: SaveCommonExpenseState,
  formData: FormData,
): Promise<SaveCommonExpenseState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'expenses:write');

  const expenseId = String(formData.get('expense_id') ?? '').trim() || null;

  const parsed = adHocCommonExpenseSchema.safeParse({
    description: String(formData.get('description') ?? '').trim(),
    amount: Number(formData.get('amount')),
    expense_date: String(formData.get('expense_date') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.generic' };
  }

  const supabase = await createClient();
  const payload = { category: 'other' as const, billing_month: null, ...parsed.data };

  const { error } = expenseId
    ? await supabase.from('common_expenses').update(payload).eq('id', expenseId)
    : await supabase.from('common_expenses').insert({ ...payload, recorded_by: profile!.id });

  if (error) return { error: 'errors.generic' };

  revalidatePath('/expenses');
  return { error: null };
}

export interface DeleteCommonExpenseState {
  error: string | null;
}

/** Owner-only, matching common_expenses' delete RLS. Works for either kind of row. */
export async function deleteCommonExpenseAction(
  _previous: DeleteCommonExpenseState,
  formData: FormData,
): Promise<DeleteCommonExpenseState> {
  const profile = await getCurrentProfile();
  assertCan(profile?.role, 'expenses:delete');

  const expenseId = String(formData.get('expense_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.from('common_expenses').delete().eq('id', expenseId);

  if (error) return { error: 'errors.generic' };

  revalidatePath('/expenses');
  return { error: null };
}
