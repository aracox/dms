'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { saveAdHocExpenseAction, type SaveCommonExpenseState } from '@/lib/common-expenses/actions';
import { bangkokToday, formatDate } from '@/lib/utils/date';
import type { CommonExpenseRow } from '@/types/database';

import { DeleteExpenseButton } from './DeleteExpenseButton';

const INITIAL_STATE: SaveCommonExpenseState = { error: null };

function AdHocExpenseForm({
  expense,
  onClose,
}: {
  expense: CommonExpenseRow | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(saveAdHocExpenseAction, INITIAL_STATE);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
      {expense ? <input type="hidden" name="expense_id" value={expense.id} /> : null}

      <div className="col-span-2 sm:col-span-2">
        <label className="text-ink text-body-sm block font-medium">
          {t('expenses.description')}
        </label>
        <Input
          name="description"
          type="text"
          maxLength={500}
          defaultValue={expense?.description ?? ''}
          required
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-ink text-body-sm block font-medium">{t('common.amount')}</label>
        <Input
          name="amount"
          type="number"
          min={0}
          step="0.01"
          defaultValue={expense?.amount}
          required
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-ink text-body-sm block font-medium">
          {t('expenses.expenseDate')}
        </label>
        <Input
          name="expense_date"
          type="date"
          defaultValue={expense?.expense_date ?? bangkokToday()}
          required
          className="mt-1"
        />
      </div>

      <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
        <Button variant="primary" size="md" type="submit" disabled={isPending}>
          {isPending ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>

      {state.error ? (
        <p className="text-brand-red-deep text-caption col-span-full">{t(state.error)}</p>
      ) : null}
    </form>
  );
}

export function AdHocExpensesSection({
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
  const [panel, setPanel] = useState<{ open: boolean; editing: CommonExpenseRow | null }>({
    open: false,
    editing: null,
  });

  const adHocEntries = expenses.filter((expense) => expense.category === 'other');

  return (
    <div className="space-y-4">
      {canWrite ? (
        panel.open ? (
          <Card>
            <CardHeader
              title={panel.editing ? t('expenses.editExpense') : t('expenses.addExpense')}
            />
            <CardBody>
              <AdHocExpenseForm
                key={panel.editing?.id ?? 'new'}
                expense={panel.editing}
                onClose={() => setPanel({ open: false, editing: null })}
              />
            </CardBody>
          </Card>
        ) : (
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => setPanel({ open: true, editing: null })}
          >
            + {t('expenses.addExpense')}
          </Button>
        )
      ) : null}

      {adHocEntries.length === 0 ? (
        <EmptyState message={t('expenses.noExpenses')} />
      ) : (
        <Card>
          <CardHeader title={t('expenses.adHocTitle')} />
          <Table
            head={
              <tr>
                <TH>{t('expenses.expenseDate')}</TH>
                <TH>{t('expenses.description')}</TH>
                <TH numeric>{t('common.amount')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {adHocEntries.map((expense) => (
              <tr key={expense.id}>
                <TD>{formatDate(expense.expense_date, locale)}</TD>
                <TD>{expense.description ?? '-'}</TD>
                <TD numeric className="font-medium">
                  {formatTHB(expense.amount, locale)}
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setPanel({ open: true, editing: expense })}
                        className="text-brand-blue-deep hover:text-brand-blue-deep"
                      >
                        {t('common.edit')}
                      </Button>
                    ) : null}
                    {canDelete ? <DeleteExpenseButton expenseId={expense.id} /> : null}
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
