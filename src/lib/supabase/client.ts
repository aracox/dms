import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Browser client. Anon key, subject to Row Level Security.
 * Use only in Client Components that genuinely need live data or realtime.
 * Prefer fetching in a Server Component via `lib/supabase/server`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
