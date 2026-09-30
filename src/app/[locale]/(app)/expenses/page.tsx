import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ExpensesSection } from '@/components/expenses/ExpensesSection';
import { PageHeader } from '@/components/layout/AppShell';
import type { Locale } from '@/i18n/routing';
import { getCommonExpenses } from '@/lib/common-expenses/queries';
import { can } from '@/lib/permissions';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function ExpensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const profile = await getCurrentProfile();
  const expenses = await getCommonExpenses();
  const canWrite = can(profile?.role, 'expenses:write');
  const canDelete = can(profile?.role, 'expenses:delete');
  const typedLocale = locale as Locale;

  return (
    <>
      <PageHeader title={t('expenses.title')} description={t('expenses.subtitle')} />

      <ExpensesSection
        expenses={expenses}
        canWrite={canWrite}
        canDelete={canDelete}
        locale={typedLocale}
      />
    </>
  );
}
