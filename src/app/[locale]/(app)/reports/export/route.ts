import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { sumMoney } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import { RECURRING_CATEGORIES } from '@/lib/reporting/expenses';
import { getExpenseMonths } from '@/lib/reporting/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { formatBillingMonth } from '@/lib/utils/date';
import { toCsv } from '@/lib/utils/csv';
import type { CommonExpenseCategory } from '@/types/database';

const CATEGORIES: readonly CommonExpenseCategory[] = [...RECURRING_CATEGORIES, 'other'];

/**
 * Downloads the reports page's data as CSV: one row per month (oldest first),
 * a column per expense category, and the month's total -- for the year the
 * page is showing (?year=), or every month when no year is given.
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const profile = await getCurrentProfile();
  if (!can(profile?.role, 'reports:read')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { locale } = await params;
  const typedLocale = (locale === 'en' ? 'en' : 'th') as Locale;
  const t = await getTranslations({ locale });

  if (new URL(request.url).searchParams.get('type') !== 'expenses') {
    return new Response('Unknown report type', { status: 400 });
  }

  // ?year= limits the file to that calendar year, matching the page; without it, every month.
  const year = new URL(request.url).searchParams.get('year');
  const rows = (await getExpenseMonths()).filter(
    (row) => !year || row.billing_month.startsWith(`${year}-`),
  );
  const months = [...new Set(rows.map((row) => row.billing_month))].sort();
  const amount = (month: string, category: CommonExpenseCategory) =>
    rows.find((row) => row.billing_month === month && row.category === category)?.amount ?? 0;

  const csv = toCsv(
    [
      t('common.month'),
      ...CATEGORIES.map((category) =>
        category === 'other' ? t('expenses.adHocTitle') : t(`expenseCategory.${category}`),
      ),
      t('reports.total'),
    ],
    months.map((month) => {
      const amounts = CATEGORIES.map((category) => amount(month, category));
      return [formatBillingMonth(month, typedLocale), ...amounts, sumMoney(amounts)];
    }),
  );

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="expenses-report${year ? `-${year}` : ''}.csv"`,
    },
  });
}
