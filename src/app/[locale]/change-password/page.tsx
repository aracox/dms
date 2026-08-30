import { Building2 } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';

export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="bg-brand-blue mx-auto flex size-11 items-center justify-center rounded-lg text-white">
            <Building2 size={22} aria-hidden="true" />
          </span>
          <h1 className="text-ink mt-3 text-lg font-semibold">
            {t('auth.mustChangePasswordTitle')}
          </h1>
          <p className="text-ink-muted mt-0.5 text-sm">{t('auth.mustChangePasswordSubtitle')}</p>
        </div>

        <div className="border-border bg-surface rounded-lg border p-5">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
