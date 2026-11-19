import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('public Supabase environment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('accepts a publishable key without a legacy anon key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example');

    const { env } = await import('./env');

    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('sb_publishable_example');
  });

  it('continues to accept a legacy anon key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-anon-key');

    const { env } = await import('./env');

    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('legacy-anon-key');
  });

  it('prefers the publishable key when both keys are configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_new');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-anon-key');

    const { env } = await import('./env');

    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('sb_publishable_new');
  });

  it('rejects configuration without either public key', async () => {
    await expect(import('./env')).rejects.toThrow('Invalid public environment');
  });
});
