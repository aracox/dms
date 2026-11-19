'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { expenseMonth, MONTHLY_CATEGORIES } from '@/lib/common-expenses/month';
import {
  currentBillingMonth,
  formatBillingMonth,
  formatDate,
  type IsoDate,
} from '@/lib/utils/date';
import type { CommonExpenseCategory, CommonExpenseRow } from '@/types/database';

import { AdHocExpenseForm } from './AdHocExpenseForm';
import { DeleteExpenseButton } from './DeleteExpenseButton';
import { MonthlyExpenseForm } from './MonthlyExpenseForm';

type FormState = { open: boolean; month: string };

/**
 * Everything on the expenses page: an entry card per recurring category, the
 * non-recurring ('other') add form, and a history table of one searched month
 * (`month`, optionally one `category`) holding both kinds with its total.
 * `filter` is the page's month search, drawn at the top of the history card.
 */
export function ExpensesSection({
  expenses,
  month,
  category,
  filter,
  canWrite,
  canDelete,
  locale,
}: {
  expenses: CommonExpenseRow[];
  month: IsoDate;
  category: CommonExpenseCategory | undefined;
  filter: ReactNode;
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

  // The recurring categories in card order, then non-recurring ones newest
  // first (the query sorts by date).
  const rank = (expense: CommonExpenseRow) =>
    expense.category === 'other'
      ? MONTHLY_CATEGORIES.length
      : MONTHLY_CATEGORIES.indexOf(expense.category);
  const entries = expenses
    .filter(
      (expense) =>
        expenseMonth(expense) === month &&
        (category === undefined || expense.category === category),
    )
    .sort((a, b) => rank(a) - rank(b));
  const monthLabel = formatBillingMonth(month, locale);

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

      <Card>
        <CardHeader
          title={t('expenses.historyFor', { month: monthLabel })}
          description={t('expenses.entryCount', { count: entries.length })}
          action={
            <span className="text-ink font-display text-h4 font-semibold tabular-nums">
              {t('expenses.monthTotal', {
                amount: formatTHB(sumMoney(entries.map((entry) => entry.amount)), locale),
              })}
            </span>
          }
        />
        {filter}
        {entries.length === 0 ? (
          <div className="p-3">
            <EmptyState message={t('expenses.noExpensesInMonth', { month: monthLabel })} />
          </div>
        ) : (
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
            {entries.map((entry) => (
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
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
