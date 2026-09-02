'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
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
        <label className="text-ink-muted block text-xs font-medium">
          {t('expenses.description')}
        </label>
        <input
          name="description"
          type="text"
          maxLength={500}
          defaultValue={expense?.description ?? ''}
          required
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-ink-muted block text-xs font-medium">{t('common.amount')}</label>
        <input
          name="amount"
          type="number"
          min={0}
          step="0.01"
          defaultValue={expense?.amount}
          required
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-ink-muted block text-xs font-medium">
          {t('expenses.expenseDate')}
        </label>
        <input
          name="expense_date"
          type="date"
          defaultValue={expense?.expense_date ?? bangkokToday()}
          required
          className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-blue hover:bg-brand-blue-deep rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? t('common.loading') : t('common.save')}
        </button>
        <button type="button" onClick={onClose} className="text-ink-subtle text-xs underline">
          {t('common.close')}
        </button>
      </div>

      {state.error ? (
        <p className="text-brand-red-deep col-span-full text-xs">{t(state.error)}</p>
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
          <button
            type="button"
            onClick={() => setPanel({ open: true, editing: null })}
            className="border-border text-ink-muted hover:bg-surface-sunken rounded-md border px-3 py-2 text-sm"
          >
            + {t('expenses.addExpense')}
          </button>
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
                      <button
                        type="button"
                        onClick={() => setPanel({ open: true, editing: expense })}
                        className="text-brand-blue-deep text-xs underline"
                      >
                        {t('common.edit')}
                      </button>
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
