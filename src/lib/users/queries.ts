import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/types/database';

/** Every staff/admin/owner account, newest first. RLS limits this to admin+. */
export async function getStaffUsers(): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}
