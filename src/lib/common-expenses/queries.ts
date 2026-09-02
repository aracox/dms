import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { CommonExpenseRow } from '@/types/database';

/** All recorded common expenses, most recent first. Test rows never surface here. */
export async function getCommonExpenses(): Promise<CommonExpenseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('common_expenses')
    .select('*')
    .eq('is_test', false)
    .order('expense_date', { ascending: false });

  return data ?? [];
}
