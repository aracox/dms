import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ExpensesSection } from '@/components/expenses/ExpensesSection';
import { PageHeader } from '@/components/layout/AppShell';
import { MonthFilter } from '@/components/ui/MonthFilter';
import type { Locale } from '@/i18n/routing';
import { EXPENSE_CATEGORIES, expenseMonth } from '@/lib/common-expenses/month';
import { getCommonExpenses } from '@/lib/common-expenses/queries';
import { can } from '@/lib/permissions';
import { getCurrentProfile } from '@/lib/supabase/server';
import { currentBillingMonth } from '@/lib/utils/date';
import { firstParam, parseMonthParams, type SearchParam } from '@/lib/utils/month-filter';
import type { CommonExpenseCategory } from '@/types/database';

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: SearchParam; month?: SearchParam; category?: SearchParam }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const query = await searchParams;
  const profile = await getCurrentProfile();
  // Every expense still loads: each recurring entry card shows its own past months.
  const expenses = await getCommonExpenses();
  const canWrite = can(profile?.role, 'expenses:write');
  const canDelete = can(profile?.role, 'expenses:delete');
  const typedLocale = locale as Locale;
  const currentMonth = currentBillingMonth();
  const month = parseMonthParams(query.year, query.month, currentMonth) ?? currentMonth;
  const categoryParam = firstParam(query.category);
  const category = EXPENSE_CATEGORIES.find((option) => option === categoryParam) as
    CommonExpenseCategory | undefined;
  const firstMonth = expenses.map(expenseMonth).reduce((a, b) => (b < a ? b : a), currentMonth);
  const categoryLabel = (option: CommonExpenseCategory) =>
    option === 'other' ? t('expenses.adHocTitle') : t(`expenseCategory.${option}`);

  return (
    <>
      <PageHeader title={t('expenses.title')} description={t('expenses.subtitle')} />

      <ExpensesSection
        expenses={expenses}
        month={month}
        category={category}
        filter={
          <MonthFilter
            label={t('expenses.filterLabel')}
            pathname="/expenses"
            month={month}
            defaultMonth={currentMonth}
            currentMonth={currentMonth}
            firstMonth={firstMonth}
            choice={{
              name: 'category',
              label: t('filters.category'),
              allLabel: t('filters.allCategories'),
              options: EXPENSE_CATEGORIES.map((option) => ({
                value: option,
                label: categoryLabel(option),
              })),
              value: category,
            }}
          />
        }
        canWrite={canWrite}
        canDelete={canDelete}
        locale={typedLocale}
      />
    </>
  );
}
