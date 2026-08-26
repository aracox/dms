'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { signInAction, type SignInState } from '@/lib/auth/actions';

const INITIAL_STATE: SignInState = { error: null };

export function LoginForm() {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(signInAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="text-ink-muted block text-xs font-medium">
          {t('auth.email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-ink-muted block text-xs font-medium">
          {t('auth.password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="border-brand-red bg-brand-red-soft text-brand-red-deep rounded border px-3 py-2 text-xs"
        >
          {t(state.error)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-blue hover:bg-brand-blue-deep w-full rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? t('auth.signingIn') : t('auth.signIn')}
      </button>
    </form>
  );
}
