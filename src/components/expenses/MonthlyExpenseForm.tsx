'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

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
      <button
        type="button"
        onClick={onOpen}
        className="border-border text-ink-muted hover:bg-surface-sunken rounded-md border px-3 py-2 text-sm"
      >
        + {t('expenses.recordMonth')}
      </button>
    );
  }

  const billingMonth = `${month}-01`;
  const existing = entries.find((entry) => entry.billing_month === billingMonth);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-ink-muted text-xs font-medium">
          {t('meters.billingMonth')}
          <input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="border-border bg-surface text-ink mt-1 block rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <button type="button" onClick={onClose} className="text-ink-subtle text-xs underline">
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
          <label className="text-ink-muted block text-xs font-medium">{t('common.amount')}</label>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={existing?.amount}
            required
            className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-ink-muted block text-xs font-medium">
            {t('expenses.description')}
          </label>
          <input
            name="description"
            type="text"
            maxLength={500}
            defaultValue={existing?.description ?? ''}
            className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !canWrite}
          className="bg-brand-blue hover:bg-brand-blue-deep h-fit rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? t('common.loading') : t('common.save')}
        </button>
      </form>

      {state.error ? <p className="text-brand-red-deep text-xs">{t(state.error)}</p> : null}
    </div>
  );
}
