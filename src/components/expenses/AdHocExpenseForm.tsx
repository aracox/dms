'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { saveAdHocExpenseAction, type SaveCommonExpenseState } from '@/lib/common-expenses/actions';
import { bangkokToday } from '@/lib/utils/date';
import type { CommonExpenseRow } from '@/types/database';

const INITIAL_STATE: SaveCommonExpenseState = { error: null };

/** Add or edit one non-recurring ('other') expense: description, amount, date. */
export function AdHocExpenseForm({
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
