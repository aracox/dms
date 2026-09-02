import { getTranslations } from 'next-intl/server';

import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-ink text-3xl font-semibold">404</p>
      <p className="text-ink-muted text-body-sm">{t('errors.notFound')}</p>
      <Link href="/dashboard" className={buttonClasses('primary', 'md')}>
        {t('nav.dashboard')}
      </Link>
    </main>
  );
}
