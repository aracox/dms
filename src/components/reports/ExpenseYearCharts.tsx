'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import type { Locale } from '@/i18n/routing';
import { sumMoney } from '@/lib/billing/money';
import type { ExpenseMonth } from '@/lib/reporting/expenses';
import { formatBillingMonth } from '@/lib/utils/date';
import type { CommonExpenseCategory } from '@/types/database';

import { CATEGORY_RING } from './category-colors';
import { ExpenseCategoryDonut } from './ExpenseCategoryDonut';
import { MonthColumnChart } from './MonthColumnChart';

/**
 * The year's charts. The first two are linked: clicking a month's column
 * narrows the donut to that month; clicking it again, or "whole year", widens
 * it back. The third compares one chosen category month by month, in that
 * category's donut color, against its own monthly average. Picked month and
 * category are view state only -- they reset when the year changes.
 */
export function ExpenseYearCharts({
  months,
  yearCategories,
  categoryLabels,
  labels,
  yearNavigator,
  tableView,
  locale,
}: {
  months: ExpenseMonth[];
  /** The whole year per category, for the donut's default view. */
  yearCategories: Record<CommonExpenseCategory, number>;
  categoryLabels: Record<CommonExpenseCategory, string>;
  labels: {
    trendTitle: string;
    trendHint: string;
    chartTitle: string;
    recurring: string;
    adHoc: string;
    total: string;
    donutTitle: string;
    donutYearHint: string;
    donutMonthHint: string;
    showWholeYear: string;
    compareTitle: string;
    compareHint: string;
    chooseCategory: string;
    average: string;
  };
  /**
   * The year stepper (?year= links, so it moves the whole page). Shown in both
   * the trend and the comparison card's title bar; the picked category is
   * client state and survives the year change.
   */
  yearNavigator: ReactNode;
  /** The trend chart's table view, under the chart. */
  tableView: ReactNode;
  locale: Locale;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const picked = months.find((month) => month.month === selected) ?? null;
  const [compared, setCompared] = useState<CommonExpenseCategory>('common_electricity');
  const comparedSlot = CATEGORY_RING.find((slot) => slot.category === compared)!;
  const comparedValues = months.map((month) => month.categories[compared]);
  const monthsWithCompared = comparedValues.filter((amount) => amount > 0);
  // The category's own average over the months it was recorded -- display only.
  const comparedAverage =
    monthsWithCompared.length === 0
      ? 0
      : Math.round((sumMoney(monthsWithCompared) / monthsWithCompared.length) * 100) / 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={labels.trendTitle}
          description={labels.trendHint}
          action={yearNavigator}
        />
        <CardBody className="space-y-4">
          <MonthColumnChart
            title={labels.chartTitle}
            series={[
              { label: labels.recurring, swatch: 'bg-chart-recurring' },
              { label: labels.adHoc, swatch: 'bg-chart-adhoc' },
            ]}
            columns={months.map((month) => ({
              month: month.month,
              values: [month.recurring, month.adHoc],
            }))}
            totalLabel={labels.total}
            locale={locale}
            selectedMonth={selected}
            onSelect={setSelected}
          />
          {tableView}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={labels.donutTitle}
          description={
            picked
              ? `${formatBillingMonth(picked.month, locale)} · ${labels.donutMonthHint}`
              : labels.donutYearHint
          }
          action={
            picked ? (
              <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
                {labels.showWholeYear}
              </Button>
            ) : null
          }
        />
        <CardBody>
          <ExpenseCategoryDonut
            amounts={picked ? picked.categories : yearCategories}
            categoryLabels={categoryLabels}
            totalLabel={picked ? formatBillingMonth(picked.month, locale) : labels.total}
            locale={locale}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={labels.compareTitle}
          description={labels.compareHint}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select
                aria-label={labels.chooseCategory}
                value={compared}
                onChange={(event) => setCompared(event.target.value as CommonExpenseCategory)}
                className="bg-surface h-9 w-auto"
              >
                {CATEGORY_RING.map((slot) => (
                  <option key={slot.category} value={slot.category}>
                    {categoryLabels[slot.category]}
                  </option>
                ))}
              </Select>
              {yearNavigator}
            </div>
          }
        />
        <CardBody>
          <MonthColumnChart
            title={`${labels.compareTitle}: ${categoryLabels[compared]}`}
            series={[{ label: categoryLabels[compared], swatch: comparedSlot.swatch }]}
            columns={months.map((month) => ({
              month: month.month,
              values: [month.categories[compared]],
            }))}
            totalLabel={labels.total}
            locale={locale}
            reference={{ value: comparedAverage, label: labels.average }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
