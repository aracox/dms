'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import type { CommonExpenseCategory, CommonExpenseRow } from '@/types/database';

import { DeleteExpenseButton } from './DeleteExpenseButton';
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

export function MonthlyExpensesSection({
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

  const monthlyEntries = expenses.filter((expense) => expense.category !== 'other');

  const editEntry = (category: CommonExpenseCategory, billingMonth: string) => {
    setForms((prev) => ({ ...prev, [category]: { open: true, month: billingMonth.slice(0, 7) } }));
  };

  return (
    <div className="space-y-4">
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

      {monthlyEntries.length === 0 ? (
        <EmptyState message={t('expenses.noExpenses')} />
      ) : (
        <Card>
          <CardHeader title={t('expenses.monthlyTitle')} />
          <Table
            head={
              <tr>
                <TH>{t('meters.billingMonth')}</TH>
                <TH>{t('expenses.category')}</TH>
                <TH>{t('expenses.description')}</TH>
                <TH numeric>{t('common.amount')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {monthlyEntries.map((entry) => (
              <tr key={entry.id}>
                <TD>{formatBillingMonth(entry.billing_month, locale)}</TD>
                <TD>{t(`expenseCategory.${entry.category}`)}</TD>
                <TD>{entry.description ?? '-'}</TD>
                <TD numeric className="font-medium">
                  {formatTHB(entry.amount, locale)}
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => editEntry(entry.category, entry.billing_month!)}
                        className="text-brand-blue-deep text-caption underline"
                      >
                        {t('common.edit')}
                      </button>
                    ) : null}
                    {canDelete ? <DeleteExpenseButton expenseId={entry.id} /> : null}
                  </div>
                </TD>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
