'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  bulkGenerateInvoicesAction,
  type BulkGenerateInvoicesState,
} from '@/lib/invoices/actions';

const INITIAL_STATE: BulkGenerateInvoicesState = { error: null, result: null };

/**
 * One click generates this month's invoice for every active contract that
 * doesn't already have one, pricing each room's subscribed extras from
 * contract_subscriptions. Reports created/skipped/failed per room afterward
 * rather than blocking the whole batch on one room's problem.
 */
export function BulkGenerateInvoicesButton() {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(bulkGenerateInvoicesAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-3">
      <Button variant="secondary" size="md" type="submit" disabled={isPending}>
        {isPending ? t('common.loading') : t('billing.generateInvoices')}
      </Button>

      {state.error ? (
        <p role="alert" className="text-brand-red-deep text-caption">
          {t(state.error)}
        </p>
      ) : null}

      {state.result ? (
        <div className="text-body-sm space-y-1.5">
          <p className={state.result.createdCount > 0 ? 'text-brand-green-deep' : 'text-ink-muted'}>
            {state.result.createdCount > 0
              ? t('billing.bulkGenerateCreated', { count: state.result.createdCount })
              : t('billing.bulkGenerateNoneCreated')}
          </p>

          {state.result.skipped.length > 0 ? (
            <p className="text-ink-muted">
              {t('billing.bulkGenerateSkipped', { count: state.result.skipped.length })}:{' '}
              {state.result.skipped.map((item) => item.roomNumber).join(', ')}
            </p>
          ) : null}

          {state.result.failed.length > 0 ? (
            <div className="text-brand-red-deep">
              <p>{t('billing.bulkGenerateFailed', { count: state.result.failed.length })}:</p>
              <ul className="ml-4 list-disc">
                {state.result.failed.map((item) => (
                  <li key={item.roomNumber}>
                    {item.roomNumber} — {t(item.error)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
