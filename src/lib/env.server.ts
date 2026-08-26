import 'server-only';
import { z } from 'zod';

/**
 * Server-only environment.
 *
 * The `server-only` import above is the guard: if a Client Component ever
 * imports this module (directly or transitively), the build fails rather than
 * shipping the service-role key to a browser.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
});

const parsed = serverSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  throw new Error(`Invalid server environment.\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;
