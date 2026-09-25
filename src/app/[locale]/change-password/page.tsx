import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { AppLogo } from '@/components/layout/AppLogo';

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
          <AppLogo size={56} className="mx-auto rounded-lg" />
          <h1 className="text-ink font-display text-h3 mt-3">
            {t('auth.mustChangePasswordTitle')}
          </h1>
          <p className="text-ink-muted text-body-sm mt-0.5">
            {t('auth.mustChangePasswordSubtitle')}
          </p>
        </div>

        <div className="border-border glass rounded-xl border p-5 shadow-md">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
