'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import { signInAction, type SignInState } from '@/lib/auth/actions';

const INITIAL_STATE: SignInState = { error: null };

export function LoginForm() {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(signInAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="text-ink text-body-sm block font-medium">
          {t('auth.email')}
          <RequiredMark />
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-ink text-body-sm block font-medium">
          {t('auth.password')}
          <RequiredMark />
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="border-brand-red bg-brand-red-soft text-brand-red-deep text-caption rounded-md border px-3 py-2"
        >
          {t(state.error)}
        </p>
      ) : null}

      <Button variant="primary" size="md" type="submit" disabled={isPending} className="w-full">
        {isPending ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
    </form>
  );
}
