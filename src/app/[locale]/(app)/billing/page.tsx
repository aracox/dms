import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { Link } from '@/i18n/navigation';

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t('billing.title')} description={t('billing.generateInvoices')} />
      <ComingSoon>
        <p>
          {t('billing.generateInvoices')} · {t('billing.print')}
        </p>
        <p className="mt-2">
          {t('common.viewDetails')}:{' '}
          <Link href="/rooms" className="text-brand-blue-deep underline">
            {t('nav.rooms')}
          </Link>{' '}
          → {t('room.tabs.billing')}
        </p>
      </ComingSoon>
    </>
  );
}
