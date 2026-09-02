'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import {
  deleteCommonExpenseAction,
  type DeleteCommonExpenseState,
} from '@/lib/common-expenses/actions';

const INITIAL_STATE: DeleteCommonExpenseState = { error: null };

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(deleteCommonExpenseAction, INITIAL_STATE);

  return (
    <form action={action}>
      <input type="hidden" name="expense_id" value={expenseId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-brand-red-deep text-caption underline disabled:opacity-60"
      >
        {isPending ? t('common.loading') : t('common.delete')}
      </button>
      {state.error ? (
        <p className="text-brand-red-deep text-caption mt-1">{t(state.error)}</p>
      ) : null}
    </form>
  );
}
