import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { ExpenseYearCharts } from '@/components/reports/ExpenseYearCharts';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB, subtractMoney } from '@/lib/billing/money';
import { buildExpenseYearReport, RECURRING_CATEGORIES } from '@/lib/reporting/expenses';
import { getExpenseMonths } from '@/lib/reporting/queries';
import { cn } from '@/lib/utils/cn';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import type { CommonExpenseCategory } from '@/types/database';

/**
 * The expenses report, one calendar year at a time: what the dorm spends each
 * month, recurring versus non-recurring, and where it goes by category.
 * Occupancy, billing and collections live on the dashboard; this page is only
 * the expenses page's data, charted. Reads report_expense_months, so test
 * data never appears. The year is ?year= (Gregorian), default this year.
 */
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const currentYear = Number(currentBillingMonth().slice(0, 4));
  const rawYear = (await searchParams).year;
  const requested = Number(Array.isArray(rawYear) ? rawYear[0] : rawYear) || currentYear;
  const report = buildExpenseYearReport(await getExpenseMonths(), requested, currentYear);

  const money = (amount: number) => formatTHB(amount, typedLocale);
  // Thai readers count years in the Buddhist era.
  const yearLabel = (year: number) => String(typedLocale === 'th' ? year + 543 : year);
  const shownYear = yearLabel(report.year);
  const previousYear = report.years.includes(report.year - 1) ? report.year - 1 : null;
  const nextYear = report.years.includes(report.year + 1) ? report.year + 1 : null;

  const categoryLabels = Object.fromEntries(
    [...RECURRING_CATEGORIES, 'other' as const].map((category) => [
      category,
      category === 'other' ? t('expenses.adHocTitle') : t(`expenseCategory.${category}`),
    ]),
  ) as Record<CommonExpenseCategory, string>;

  // A stepper: square arrow buttons either side of the one year shown. The
  // neighbouring year is only in the arrows' labels, never printed beside the
  // current one, so the control cannot read as a range.
  const stepButton = (year: number | null, direction: 'previous' | 'next') => {
    const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
    const edge = direction === 'previous' ? 'border-r' : 'border-l';
    if (year === null) {
      return (
        <span
          aria-hidden="true"
          className={cn('border-border text-ink-subtle/40 flex items-center px-2.5', edge)}
        >
          <Icon size={18} />
        </span>
      );
    }
    const label = t(direction === 'previous' ? 'reports.previousYear' : 'reports.nextYear', {
      year: yearLabel(year),
    });
    return (
      <Link
        href={{ pathname: '/reports', query: { year } }}
        // Same page, different year: keep the reader where they are instead
        // of jumping to the top (the stepper also sits in the last card).
        scroll={false}
        aria-label={label}
        title={label}
        className={cn(
          'border-border text-ink hover:bg-surface-sunken flex items-center px-2.5 transition-colors',
          edge,
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </Link>
    );
  };

  // Sits in the chart card's title bar; it switches the whole page, tiles included.
  const yearNavigator = (
    <nav
      aria-label={t('reports.yearNavigation')}
      className="border-border bg-surface flex h-9 items-stretch overflow-hidden rounded-md border"
    >
      {stepButton(previousYear, 'previous')}
      <span
        className="text-ink flex min-w-24 items-center justify-center px-4 font-semibold whitespace-nowrap"
        aria-live="polite"
      >
        {t('reports.yearLabel', { year: shownYear })}
      </span>
      {stepButton(nextYear, 'next')}
    </nav>
  );

  return (
    <>
      <PageHeader
        title={t('reports.expenseTitle')}
        description={t('reports.expenseSubtitle')}
        action={
          <Link
            href={{ pathname: '/reports/export', query: { type: 'expenses', year: report.year } }}
            className={buttonClasses('secondary', 'sm')}
          >
            <Download size={12} aria-hidden="true" />
            {t('reports.export')}
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label={t('reports.yearTotal')}
          value={money(report.yearTotal)}
          hint={t('reports.yearLabel', { year: shownYear })}
          tone="blue"
        />
        <StatTile
          label={t('reports.monthlyAverage')}
          value={money(report.monthlyAverage)}
          hint={t('reports.monthsWithData', { count: report.monthsWithData })}
        />
        <StatTile
          label={t('reports.highestMonth')}
          value={report.highestMonth ? money(report.highestMonth.total) : '–'}
          hint={
            report.highestMonth ? formatBillingMonth(report.highestMonth.month, typedLocale) : ''
          }
        />
        <StatTile
          label={t('reports.adHocYearTotal')}
          value={money(report.adHocTotal)}
          hint={t('reports.yearLabel', { year: shownYear })}
          tone="yellow"
        />
      </div>

      {report.yearTotal === 0 ? (
        // Still a card with the navigator, so an empty year never strands you.
        <Card>
          <CardHeader title={t('reports.trendTitle')} action={yearNavigator} />
          <CardBody>
            <EmptyState message={t('reports.noExpensesInYear', { year: shownYear })} />
          </CardBody>
        </Card>
      ) : (
        <ExpenseYearCharts
          months={report.months}
          yearCategories={report.categories}
          categoryLabels={categoryLabels}
          labels={{
            trendTitle: t('reports.trendTitle'),
            trendHint: t('reports.trendHint'),
            chartTitle: `${t('reports.trendTitle')} ${t('reports.yearLabel', { year: shownYear })}`,
            recurring: t('reports.recurring'),
            adHoc: t('expenses.adHocTitle'),
            total: t('reports.total'),
            donutTitle: t('reports.donutTitle'),
            donutYearHint: t('reports.donutYearHint', { year: shownYear }),
            donutMonthHint: t('reports.donutMonthHint'),
            showWholeYear: t('reports.showWholeYear'),
            compareTitle: t('reports.compareTitle'),
            compareHint: t('reports.compareHint'),
            chooseCategory: t('reports.chooseCategory'),
            average: t('reports.average'),
          }}
          yearNavigator={yearNavigator}
          tableView={
            // The table view: the ochre series is under 3:1, so every value is readable as text.
            <details>
              <summary className="text-brand-blue-deep text-body-sm cursor-pointer font-medium">
                {t('reports.showTable')}
              </summary>
              <div className="mt-3">
                <Table
                  head={
                    <tr>
                      <TH>{t('common.month')}</TH>
                      <TH numeric>{t('reports.recurring')}</TH>
                      <TH numeric>{t('expenses.adHocTitle')}</TH>
                      <TH numeric>{t('reports.total')}</TH>
                    </tr>
                  }
                >
                  {report.months.map((month) => (
                    <tr key={month.month}>
                      <TD>{formatBillingMonth(month.month, typedLocale)}</TD>
                      <TD numeric>{money(month.recurring)}</TD>
                      <TD numeric>{money(month.adHoc)}</TD>
                      <TD numeric className="font-semibold">
                        {money(month.total)}
                      </TD>
                    </tr>
                  ))}
                  <tr className="bg-surface-sunken">
                    <TD className="font-semibold">{t('reports.total')}</TD>
                    <TD numeric className="font-semibold">
                      {money(subtractMoney(report.yearTotal, report.adHocTotal))}
                    </TD>
                    <TD numeric className="font-semibold">
                      {money(report.adHocTotal)}
                    </TD>
                    <TD numeric className="font-semibold">
                      {money(report.yearTotal)}
                    </TD>
                  </tr>
                </Table>
              </div>
            </details>
          }
          locale={typedLocale}
        />
      )}
    </>
  );
}
