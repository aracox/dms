'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
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
      <Button
        type="submit"
        variant="link"
        size="sm"
        disabled={isPending}
        className="text-brand-red-deep hover:text-brand-red-deep"
      >
        {isPending ? t('common.loading') : t('common.delete')}
      </Button>
      {state.error ? (
        <p className="text-brand-red-deep text-caption mt-1">{t(state.error)}</p>
      ) : null}
    </form>
  );
}
