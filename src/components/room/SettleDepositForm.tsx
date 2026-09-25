'use client';

import { useTranslations } from 'next-intl';

import { DepositSettlementForm } from '@/components/deposits/DepositSettlementForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { formatDate } from '@/lib/utils/date';

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
        {outstanding > 0 ? (
          <p className="text-brand-yellow-deep text-caption mb-3">
            {t('contract.outstandingHint', { amount: formatTHB(outstanding, locale) })}
          </p>
        ) : null}
        <DepositSettlementForm
          contractId={contractId}
          roomId={roomId}
          deposit={deposit}
          locale={locale}
        />
      </CardBody>
    </Card>
  );
}
