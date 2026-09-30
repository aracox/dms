'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import {
  billingMonthOf,
  currentBillingMonth,
  formatBillingMonth,
  formatDate,
} from '@/lib/utils/date';
import type { CommonExpenseCategory, CommonExpenseRow } from '@/types/database';

import { AdHocExpenseForm } from './AdHocExpenseForm';
import { DeleteExpenseButton } from './DeleteExpenseButton';
import { MonthToggleCell, useOpenMonths } from '@/components/ui/MonthGroup';
import { Pager, usePager } from '@/components/ui/Pager';
import { MonthlyExpenseForm } from './MonthlyExpenseForm';

const MONTHLY_CATEGORIES: readonly CommonExpenseCategory[] = [
  'common_electricity',
  'common_water',
  'housekeeping',
  'gardening',
  'internet',
  'transformer_fee',
];

type FormState = { open: boolean; month: string };

/** Month groups shown per page of the history table. */
const MONTHS_PER_PAGE = 6;

/** The month an expense counts toward: its billing month, or for 'other' its date's month. */
function expenseMonth(expense: CommonExpenseRow): string {
  return expense.category === 'other'
    ? billingMonthOf(expense.expense_date)
    : expense.billing_month!;
}

/**
 * Everything on the expenses page: an entry card per recurring category, the
 * non-recurring ('other') add form, and one history table holding both kinds,
 * grouped by month so each month shows its full shared-cost total.
 */
export function ExpensesSection({
  expenses,
  canWrite,
  canDelete,
  locale,
}: {
  expenses: CommonExpenseRow[];
  canWrite: boolean;
  canDelete: boolean;
  locale: Locale;
}) {
  const t = useTranslations();
  const defaultMonth = currentBillingMonth().slice(0, 7);
  const [forms, setForms] = useState<Record<CommonExpenseCategory, FormState>>({
    common_electricity: { open: false, month: defaultMonth },
    common_water: { open: false, month: defaultMonth },
    housekeeping: { open: false, month: defaultMonth },
    gardening: { open: false, month: defaultMonth },
    internet: { open: false, month: defaultMonth },
    transformer_fee: { open: false, month: defaultMonth },
    other: { open: false, month: defaultMonth },
  });
  const [adHocPanel, setAdHocPanel] = useState<{
    open: boolean;
    editing: CommonExpenseRow | null;
  }>({ open: false, editing: null });

  const monthlyEntries = expenses.filter((expense) => expense.category !== 'other');

  // Newest month first. Inside a month: the recurring categories in card
  // order, then non-recurring ones newest first (the query sorts by date).
  const months = new Map<string, CommonExpenseRow[]>();
  for (const expense of expenses) {
    const month = expenseMonth(expense);
    months.set(month, [...(months.get(month) ?? []), expense]);
  }
  const rank = (expense: CommonExpenseRow) =>
    expense.category === 'other'
      ? MONTHLY_CATEGORIES.length
      : MONTHLY_CATEGORIES.indexOf(expense.category);
  const groupedMonths = [...months]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, entries]) => ({
      month,
      entries: [...entries].sort((a, b) => rank(a) - rank(b)),
    }));
  const monthGroups = useOpenMonths(groupedMonths[0]?.month);

  const {
    page,
    pageCount,
    setPage,
    pageItems: pageMonths,
  } = usePager(groupedMonths, MONTHS_PER_PAGE);

  const editEntry = (expense: CommonExpenseRow) => {
    if (expense.category === 'other') {
      setAdHocPanel({ open: true, editing: expense });
      return;
    }
    setForms((prev) => ({
      ...prev,
      [expense.category]: { open: true, month: expense.billing_month!.slice(0, 7) },
    }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-ink text-sm font-semibold">{t('expenses.monthlyTitle')}</h2>
      {canWrite ? (
        <div className="grid gap-4 md:grid-cols-2">
          {MONTHLY_CATEGORIES.map((category) => (
            <Card key={category}>
              <CardHeader title={t(`expenseCategory.${category}`)} />
              <CardBody>
                <MonthlyExpenseForm
                  category={category}
                  entries={monthlyEntries.filter((entry) => entry.category === category)}
                  canWrite={canWrite}
                  open={forms[category].open}
                  month={forms[category].month}
                  onOpen={() =>
                    setForms((prev) => ({ ...prev, [category]: { ...prev[category], open: true } }))
                  }
                  onClose={() =>
                    setForms((prev) => ({
                      ...prev,
                      [category]: { ...prev[category], open: false },
                    }))
                  }
                  onMonthChange={(month) =>
                    setForms((prev) => ({ ...prev, [category]: { open: true, month } }))
                  }
                />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <h2 className="text-ink pt-4 text-sm font-semibold">{t('expenses.adHocTitle')}</h2>
      {canWrite ? (
        adHocPanel.open ? (
          <Card>
            <CardHeader
              title={adHocPanel.editing ? t('expenses.editExpense') : t('expenses.addExpense')}
            />
            <CardBody>
              <AdHocExpenseForm
                key={adHocPanel.editing?.id ?? 'new'}
                expense={adHocPanel.editing}
                onClose={() => setAdHocPanel({ open: false, editing: null })}
              />
            </CardBody>
          </Card>
        ) : (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setAdHocPanel({ open: true, editing: null })}
          >
            + {t('expenses.addExpense')}
          </Button>
        )
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState message={t('expenses.noExpenses')} />
      ) : (
        <Card>
          <CardHeader title={t('expenses.historyTitle')} />
          <Table
            head={
              <tr>
                <TH>{t('expenses.category')}</TH>
                <TH>{t('expenses.expenseDate')}</TH>
                <TH>{t('expenses.description')}</TH>
                <TH numeric>{t('common.amount')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {pageMonths.map(({ month, entries }) => [
              <tr key={month} className="bg-surface-sunken">
                <MonthToggleCell
                  colSpan={3}
                  label={formatBillingMonth(month, locale)}
                  open={monthGroups.isOpen(month)}
                  onToggle={() => monthGroups.toggle(month)}
                />
                <TD numeric className="font-semibold">
                  {formatTHB(sumMoney(entries.map((entry) => entry.amount)), locale)}
                </TD>
                <TD className="text-ink-subtle text-caption">
                  {t('expenses.entryCount', { count: entries.length })}
                </TD>
              </tr>,
              ...(monthGroups.isOpen(month)
                ? entries.map((entry) => (
                    <tr key={entry.id}>
                      <TD>
                        {entry.category === 'other'
                          ? t('expenses.adHocTitle')
                          : t(`expenseCategory.${entry.category}`)}
                      </TD>
                      <TD>{formatDate(entry.expense_date, locale)}</TD>
                      <TD>{entry.description ?? '-'}</TD>
                      <TD numeric className="font-medium">
                        {formatTHB(entry.amount, locale)}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          {canWrite ? (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => editEntry(entry)}
                              className="text-brand-blue-deep hover:text-brand-blue-deep"
                            >
                              {t('common.edit')}
                            </Button>
                          ) : null}
                          {canDelete ? <DeleteExpenseButton expenseId={entry.id} /> : null}
                        </div>
                      </TD>
                    </tr>
                  ))
                : []),
            ])}
          </Table>
          <Pager page={page} pageCount={pageCount} setPage={setPage} />
        </Card>
      )}
    </div>
  );
}
