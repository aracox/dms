'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import { changePasswordAction, type ChangePasswordState } from '@/lib/auth/actions';

const INITIAL_STATE: ChangePasswordState = { error: null };

export function ChangePasswordForm() {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(changePasswordAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="text-ink text-body-sm block font-medium">
          {t('auth.newPassword')}
          <RequiredMark />
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="mt-1"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="text-ink text-body-sm block font-medium">
          {t('auth.confirmPassword')}
          <RequiredMark />
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
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
        {isPending ? t('auth.changingPassword') : t('auth.changePassword')}
      </Button>
    </form>
  );
}
