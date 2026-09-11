'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { settleDepositAction, type SettleDepositState } from '@/lib/contracts/actions';
import { formatDate } from '@/lib/utils/date';

const INITIAL_STATE: SettleDepositState = { error: null };

/**
 * Shown for a terminated contract with no deposit_settled_at yet. A separate
 * step from move-out itself -- the final figure often is not known until a
 * damage check or the last utility bill, sometimes days after move-out.
 */
export function SettleDepositForm({
  contractId,
  roomId,
  tenantName,
  terminatedAt,
  deposit,
  outstanding,
  locale,
}: {
  contractId: string;
  roomId: string;
  tenantName: string;
  terminatedAt: string;
  deposit: number;
  outstanding: number;
  locale: Locale;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(settleDepositAction, INITIAL_STATE);

  return (
    <Card>
      <CardHeader
        title={t('contract.settleDeposit')}
        description={t('contract.settleDepositHint', {
          tenant: tenantName,
          date: formatDate(terminatedAt, locale),
          deposit: formatTHB(deposit, locale),
        })}
      />
      <CardBody>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="contract_id" value={contractId} />
          <input type="hidden" name="room_id" value={roomId} />

          {outstanding > 0 ? (
            <p className="text-brand-yellow-deep text-caption">
              {t('contract.outstandingHint', { amount: formatTHB(outstanding, locale) })}
            </p>
          ) : null}

          <FormField label={t('contract.deduction')} htmlFor="deduction">
            <Input
              id="deduction"
              name="deduction"
              type="number"
              min={0}
              max={deposit}
              step="0.01"
              defaultValue={0}
              required
            />
          </FormField>

          <FormField label={t('common.note')} htmlFor="note">
            <Input id="note" name="note" type="text" maxLength={1000} />
          </FormField>

          <Button variant="primary" size="sm" type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>

          {state.error ? (
            <p role="alert" className="text-brand-red-deep text-caption">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
