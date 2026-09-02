'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  saveMonthlyExpenseAction,
  type SaveCommonExpenseState,
} from '@/lib/common-expenses/actions';
import type { CommonExpenseCategory, CommonExpenseRow } from '@/types/database';

const INITIAL_STATE: SaveCommonExpenseState = { error: null };

/**
 * Collapsed by default: a "+ Record this month" button reveals a month
 * picker. Picking a month that already has an amount loads it for editing.
 */
export function MonthlyExpenseForm({
  category,
  entries,
  canWrite,
  open,
  month,
  onOpen,
  onClose,
  onMonthChange,
}: {
  category: CommonExpenseCategory;
  entries: CommonExpenseRow[];
  canWrite: boolean;
  open: boolean;
  month: string;
  onOpen: () => void;
  onClose: () => void;
  onMonthChange: (month: string) => void;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(saveMonthlyExpenseAction, INITIAL_STATE);

  if (!open) {
    return (
      <Button variant="secondary" size="md" type="button" onClick={onOpen}>
        + {t('expenses.recordMonth')}
      </Button>
    );
  }

  const billingMonth = `${month}-01`;
  const existing = entries.find((entry) => entry.billing_month === billingMonth);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-ink text-body-sm font-medium">
          {t('meters.billingMonth')}
          <Input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="mt-1 block w-auto"
          />
        </label>
        <button type="button" onClick={onClose} className="text-ink-subtle text-caption underline">
          {t('common.close')}
        </button>
      </div>

      <form
        key={month}
        action={formAction}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-end"
      >
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="billing_month" value={billingMonth} />

        <div>
          <label className="text-ink text-body-sm block font-medium">{t('common.amount')}</label>
          <Input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={existing?.amount}
            required
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-ink text-body-sm block font-medium">
            {t('expenses.description')}
          </label>
          <Input
            name="description"
            type="text"
            maxLength={500}
            defaultValue={existing?.description ?? ''}
            className="mt-1"
          />
        </div>

        <Button variant="primary" size="md" type="submit" disabled={isPending || !canWrite}>
          {isPending ? t('common.loading') : t('common.save')}
        </Button>
      </form>

      {state.error ? <p className="text-brand-red-deep text-caption">{t(state.error)}</p> : null}
    </div>
  );
}
