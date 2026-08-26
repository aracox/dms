import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { Link } from '@/i18n/navigation';

export default async function MetersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t('meters.title')} description={t('meters.billingMonth')} />
      <ComingSoon>
        <p>{t('meters.title')}</p>
        <p className="mt-2">
          {t('common.viewDetails')}:{' '}
          <Link href="/reports" className="text-brand-blue-deep underline">
            {t('reports.meterUsage')}
          </Link>{' '}
          · {t('nav.rooms')} → {t('room.tabs.meters')}
        </p>
      </ComingSoon>
    </>
  );
}
