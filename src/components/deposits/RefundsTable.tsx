import { CheckCircle2, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { DepositRefundRecord } from '@/lib/contracts/queries';
import { propertySegment } from '@/lib/reporting/segments';
import { formatDate } from '@/lib/utils/date';

import { DepositSettlementCells } from './DepositSettlementForm';

/**
 * A list of deposit refunds, already filtered by the page. Waiting rows carry
 * the settlement inputs; refunded rows show what was recorded.
 */
export function RefundsTable({
  records,
  canWrite,
  locale,
  emptyMessage,
}: {
  records: DepositRefundRecord[];
  canWrite: boolean;
  locale: Locale;
  emptyMessage: string;
}) {
  const t = useTranslations();

  return (
    <>
      {records.length === 0 ? (
        <div className="p-3">
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <Table
          head={
            <tr>
              <TH>{t('room.roomNumber')}</TH>
              <TH>{t('deposits.previousTenant')}</TH>
              <TH>{t('deposits.movedOutOn')}</TH>
              <TH numeric>{t('room.deposit')}</TH>
              <TH>{t('common.status')}</TH>
              <TH>{t('contract.actualRefund')}</TH>
              <TH>{t('contract.deductionReason')}</TH>
              <TH>
                <span className="sr-only">{t('deposits.recordRefund')}</span>
              </TH>
            </tr>
          }
        >
          {records.map((record) => {
            const { contract } = record;
            return (
              // Top-aligned so the text lines up with the inputs, not with their hints.
              <tr
                key={contract.id}
                className="[&>td]:align-top [&>td:not(:has(input,button))]:pt-4"
              >
                <TD>
                  <Link
                    href={`/rooms/${contract.room_id}?tab=contract`}
                    className="text-brand-blue-deep font-medium underline"
                  >
                    {record.roomNumber}
                  </Link>
                  <div className="mt-1">
                    <SegmentBadge segment={propertySegment(record.roomType)} />
                  </div>
                </TD>
                <TD>
                  {record.tenantName}
                  {record.tenantPhone ? (
                    <p className="text-ink-subtle text-caption">{record.tenantPhone}</p>
                  ) : null}
                </TD>
                <TD>{formatDate(contract.terminated_at ?? contract.end_date, locale)}</TD>
                <TD numeric>{formatTHB(contract.deposit, locale)}</TD>
                <TD>
                  {record.status === 'pending' ? (
                    <Badge tone="yellow" icon={<Clock size={12} aria-hidden="true" />}>
                      {t('deposits.status.pending')}
                    </Badge>
                  ) : (
                    <Badge tone="green" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
                      {t('deposits.status.refunded')}
                    </Badge>
                  )}
                </TD>
                {record.status === 'pending' && canWrite ? (
                  <DepositSettlementCells
                    contractId={contract.id}
                    roomId={contract.room_id}
                    deposit={contract.deposit}
                    locale={locale}
                  />
                ) : record.status === 'pending' ? (
                  <>
                    <TD>-</TD>
                    <TD>-</TD>
                    <TD />
                  </>
                ) : (
                  <>
                    <TD>
                      {formatTHB(contract.deposit_refund ?? 0, locale)}
                      {contract.deposit_deduction > 0 ? (
                        <p className="text-ink-subtle text-caption">
                          {t('deposits.deductedShort', {
                            amount: formatTHB(contract.deposit_deduction, locale),
                          })}
                        </p>
                      ) : null}
                    </TD>
                    <TD className="whitespace-pre-line">
                      {contract.deposit_settlement_note || '-'}
                    </TD>
                    <TD className="text-ink-subtle text-caption whitespace-nowrap">
                      {contract.deposit_settled_at
                        ? t('contract.depositSettledOn', {
                            date: formatDate(contract.deposit_settled_at, locale),
                          })
                        : null}
                    </TD>
                  </>
                )}
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
