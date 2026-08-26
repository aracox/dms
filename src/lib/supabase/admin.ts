import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';
import type { Database } from '@/types/database';

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only for system work that has no user context: seeding, scheduled jobs,
 * the overdue sweep. If a user triggered the action, use `lib/supabase/server`
 * so their role is enforced.
 *
 * Note that bypassing RLS does not bypass the database's business rules --
 * generated columns, CHECK constraints and triggers still apply, including the
 * is_test containment rules.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
