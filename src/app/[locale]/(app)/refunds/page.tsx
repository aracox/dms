import { getTranslations, setRequestLocale } from 'next-intl/server';

import { RefundsTable } from '@/components/deposits/RefundsTable';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { getDepositRefunds } from '@/lib/contracts/queries';
import { can } from '@/lib/permissions';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function RefundsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const [records, profile] = await Promise.all([getDepositRefunds(), getCurrentProfile()]);
  const pending = records.filter((record) => record.status === 'pending');

  return (
    <>
      <PageHeader
        title={t('deposits.title')}
        description={
          pending.length > 0
            ? t('deposits.subtitle', {
                count: pending.length,
                amount: formatTHB(
                  sumMoney(pending.map((record) => record.contract.deposit)),
                  typedLocale,
                ),
              })
            : t('deposits.nonePending')
        }
      />

      <Card>
        <RefundsTable
          records={records}
          canWrite={can(profile?.role, 'contracts:write')}
          locale={typedLocale}
        />
      </Card>
    </>
  );
}
