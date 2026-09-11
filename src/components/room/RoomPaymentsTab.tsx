import { getTranslations } from 'next-intl/server';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import type { RoomDetail } from '@/lib/rooms/queries';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/date';
import type { PaymentStatus } from '@/types/database';

import { ConfirmRejectPaymentButtons } from './ConfirmRejectPaymentButtons';

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'yellow',
  confirmed: 'green',
  cancelled: 'neutral',
};

export async function RoomPaymentsTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = await getTranslations();
  const profile = await getCurrentProfile();
  const canConfirm = can(profile?.role, 'payments:confirm');

  const payments = detail.invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({
      payment,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
    })),
  );

  if (payments.length === 0) {
    return <EmptyState message={t('room.noPayments')} />;
  }

  const slipsWithPath = payments.filter(({ payment }) => payment.slip_path);
  const slipUrlById = new Map<string, string>();
  if (slipsWithPath.length > 0) {
    const supabase = await createClient();
    const signed = await Promise.all(
      slipsWithPath.map(({ payment }) =>
        supabase.storage.from('payment-slips').createSignedUrl(payment.slip_path!, 3600),
      ),
    );
    slipsWithPath.forEach(({ payment }, index) => {
      const url = signed[index]?.data?.signedUrl;
      if (url) slipUrlById.set(payment.id, url);
    });
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
            <TH>{t('common.actions')}</TH>
          </tr>
        }
      >
        {payments.map(({ payment, invoiceId, invoiceNumber }) => (
          <tr key={payment.id}>
            <TD>{formatDate(payment.payment_date, locale)}</TD>
            <TD>{invoiceNumber}</TD>
            <TD>{t(`paymentMethod.${payment.payment_method}`)}</TD>
            <TD>
              {payment.reference ?? t('common.notAvailable')}
              {slipUrlById.has(payment.id) ? (
                <a
                  href={slipUrlById.get(payment.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-blue-deep text-caption ml-1.5 underline"
                >
                  {t('payments.viewSlip')}
                </a>
              ) : null}
            </TD>
            <TD numeric className="font-medium">
              {formatTHB(payment.amount, locale)}
            </TD>
            <TD>
              <div className="flex flex-col items-start gap-1.5">
                <Badge tone={PAYMENT_TONE[payment.status]}>
                  {t(`paymentStatus.${payment.status}`)}
                </Badge>
                {canConfirm && payment.status === 'pending' ? (
                  <ConfirmRejectPaymentButtons
                    paymentId={payment.id}
                    roomId={detail.room.id}
                    invoiceId={invoiceId}
                  />
                ) : null}
              </div>
            </TD>
            <TD>
              {payment.status === 'confirmed' ? (
                <Link
                  href={`/payments/${payment.id}/receipt`}
                  className="text-brand-blue-deep text-caption underline"
                >
                  {t('payments.receipt')}
                </Link>
              ) : null}
            </TD>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
