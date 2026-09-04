import { Building2 } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';

import { LoginForm } from './LoginForm';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const { locale } = await params;
  const { passwordChanged } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="bg-brand-blue mx-auto flex size-11 items-center justify-center rounded-lg text-white">
            <Building2 size={22} aria-hidden="true" />
          </span>
          <h1 className="text-ink font-display text-h3 mt-3">{t('app.name')}</h1>
          <p className="text-ink-muted text-body-sm mt-0.5">{t('auth.signInSubtitle')}</p>
        </div>

        <div className="border-border glass rounded-xl border p-5 shadow-md">
          {passwordChanged ? (
            <p className="border-brand-green bg-brand-green-soft text-brand-green-deep text-caption mb-4 rounded-md border px-3 py-2">
              {t('auth.passwordChangedSignInAgain')}
            </p>
          ) : null}
          <LoginForm />
        </div>

        <div className="mt-4 flex justify-center">
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}
