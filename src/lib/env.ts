import { z } from 'zod';

/**
 * Public environment. Safe in the browser bundle.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_X` when it is written as a
 * literal member access, so each key is spelled out rather than spread.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url('NEXT_PUBLIC_SUPABASE_URL must be a URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment. Copy .env.example to .env.local and fill it in.\n${z.prettifyError(
      parsed.error,
    )}`,
  );
}

export const env = parsed.data;
