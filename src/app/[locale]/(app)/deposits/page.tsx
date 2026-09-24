import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MarkRefundedButton } from '@/components/deposits/MarkRefundedButton';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { getPendingDepositRefunds } from '@/lib/contracts/queries';
import { can } from '@/lib/permissions';
import { getCurrentProfile } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/date';

export default async function DepositsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const [refunds, profile] = await Promise.all([getPendingDepositRefunds(), getCurrentProfile()]);
  const canWrite = can(profile?.role, 'contracts:write');

  return (
    <>
      <PageHeader
        title={t('deposits.title')}
        description={
          refunds.length > 0
            ? t('deposits.subtitle', {
                count: refunds.length,
                amount: formatTHB(
                  sumMoney(refunds.map((row) => row.contract.deposit)),
                  typedLocale,
                ),
              })
            : undefined
        }
      />

      <Card>
        {refunds.length === 0 ? (
          <div className="p-3">
            <EmptyState message={t('deposits.empty')} />
          </div>
        ) : (
          <Table
            head={
              <tr>
                <TH>{t('room.roomNumber')}</TH>
                <TH>{t('deposits.previousTenant')}</TH>
                <TH>{t('deposits.movedOutOn')}</TH>
                <TH numeric>{t('room.deposit')}</TH>
                <TH numeric>{t('deposits.outstanding')}</TH>
                {canWrite ? <TH>{t('common.actions')}</TH> : null}
              </tr>
            }
          >
            {refunds.map(({ contract, roomNumber, tenantName, outstanding }) => (
              <tr key={contract.id}>
                <TD>
                  <Link
                    href={`/rooms/${contract.room_id}?tab=contract`}
                    className="text-brand-blue-deep font-medium underline"
                  >
                    {roomNumber}
                  </Link>
                </TD>
                <TD>{tenantName}</TD>
                <TD>{formatDate(contract.terminated_at ?? contract.end_date, typedLocale)}</TD>
                <TD numeric>{formatTHB(contract.deposit, typedLocale)}</TD>
                <TD numeric>
                  {outstanding > 0 ? (
                    <span className="text-brand-red-deep">
                      {formatTHB(outstanding, typedLocale)}
                    </span>
                  ) : (
                    '-'
                  )}
                </TD>
                {canWrite ? (
                  <TD>
                    <MarkRefundedButton
                      contractId={contract.id}
                      roomId={contract.room_id}
                      deposit={contract.deposit}
                      locale={typedLocale}
                    />
                  </TD>
                ) : null}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
