'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import {
  updateContractSubscriptionsAction,
  type UpdateSubscriptionsState,
} from '@/lib/contracts/actions';
import {
  EXTRA_FEE_LABEL_KEY,
  SUBSCRIPTION_FEE_KEYS,
  type SubscriptionFeeKey,
} from '@/lib/invoices/fees';

const INITIAL_STATE: UpdateSubscriptionsState = { error: null };

/**
 * Which recurring extras (internet, parking, streaming) this room's contract
 * is on the hook for every month. GenerateInvoiceForm reads the same set to
 * pre-check its own checkboxes, so this is the one place staff correct it.
 */
export function ContractSubscriptionsCard({
  contractId,
  roomId,
  fees,
  active,
  canEdit,
  locale,
}: {
  contractId: string;
  roomId: string;
  fees: Record<string, number>;
  active: readonly string[];
  canEdit: boolean;
  locale: Locale;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(
    updateContractSubscriptionsAction,
    INITIAL_STATE,
  );

  return (
    <Card>
      <CardHeader
        title={t('contract.subscriptions')}
        description={t('contract.subscriptionsHint')}
      />
      <CardBody>
        {canEdit ? (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="contract_id" value={contractId} />
            <input type="hidden" name="room_id" value={roomId} />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUBSCRIPTION_FEE_KEYS.map((key) => (
                <label key={key} className="text-ink text-body-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="subscription"
                    value={key}
                    defaultChecked={active.includes(key)}
                    className="accent-brand-blue size-5 rounded-sm"
                  />
                  {t(EXTRA_FEE_LABEL_KEY[key])} · {formatTHB(fees[key] ?? 0, locale)}
                </label>
              ))}
            </div>

            <Button variant="primary" size="sm" type="submit" disabled={isPending}>
              {isPending ? t('common.loading') : t('common.save')}
            </Button>

            {state.error ? (
              <p role="alert" className="text-brand-red-deep text-caption">
                {t(state.error)}
              </p>
            ) : null}
          </form>
        ) : active.length === 0 ? (
          <p className="text-ink-subtle text-body-sm">{t('contract.noSubscriptions')}</p>
        ) : (
          <p className="text-ink text-body-sm">
            {active.map((key) => t(EXTRA_FEE_LABEL_KEY[key as SubscriptionFeeKey])).join(', ')}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
