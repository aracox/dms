import { useTranslations } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { RoomDetail } from '@/lib/rooms/queries';
import { formatDate } from '@/lib/utils/date';
import type { PaymentStatus } from '@/types/database';

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'yellow',
  confirmed: 'green',
  cancelled: 'neutral',
};

export function RoomPaymentsTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = useTranslations();

  const payments = detail.invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({ payment, invoiceNumber: invoice.invoice_number })),
  );

  if (payments.length === 0) {
    return <EmptyState message={t('room.noPayments')} />;
  }

  return (
    <Card>
      <CardHeader title={t('payments.history')} />
      <Table
        head={
          <tr>
            <TH>{t('payments.paymentDate')}</TH>
            <TH>{t('billing.invoiceNumber')}</TH>
            <TH>{t('payments.method')}</TH>
            <TH>{t('payments.reference')}</TH>
            <TH numeric>{t('common.amount')}</TH>
            <TH>{t('common.status')}</TH>
          </tr>
        }
      >
        {payments.map(({ payment, invoiceNumber }) => (
          <tr key={payment.id}>
            <TD>{formatDate(payment.payment_date, locale)}</TD>
            <TD>{invoiceNumber}</TD>
            <TD>{t(`paymentMethod.${payment.payment_method}`)}</TD>
            <TD>
              {payment.reference ?? t('common.notAvailable')}
              {payment.slip_path ? (
                <span className="text-ink-subtle text-caption ml-1.5">({t('payments.slip')})</span>
              ) : null}
            </TD>
            <TD numeric className="font-medium">
              {formatTHB(payment.amount, locale)}
            </TD>
            <TD>
              <Badge tone={PAYMENT_TONE[payment.status]}>
                {t(`paymentStatus.${payment.status}`)}
              </Badge>
            </TD>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
