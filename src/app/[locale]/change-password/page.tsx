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
      <div className="glass border-border w-full max-w-md overflow-hidden rounded-xl border shadow-xl">
        <div className="border-border border-b px-6 py-8 text-center sm:px-8">
          <AppLogo size={56} className="mx-auto rounded-lg" />
          <h1 className="text-ink font-display text-h3 mt-3">
            {t('auth.mustChangePasswordTitle')}
          </h1>
          <p className="text-ink-muted text-body-sm mt-0.5">
            {t('auth.mustChangePasswordSubtitle')}
          </p>
        </div>

        <div className="glass-surface px-6 py-7 sm:px-8">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
