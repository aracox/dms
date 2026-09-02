import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { INVOICE_TONE } from '@/components/room/RoomBillingTab';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { getOutstandingInvoices, getPaymentCollection } from '@/lib/reporting/queries';
import { formatBillingMonth, formatDate } from '@/lib/utils/date';

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const [outstanding, collection] = await Promise.all([
    getOutstandingInvoices(),
    getPaymentCollection(12),
  ]);

  return (
    <>
      <PageHeader title={t('payments.title')} description={t('reports.subtitle')} />

      <div className="mb-4">
        <ComingSoon>
          {t('payments.recordPayment')} · {t('payments.uploadSlip')} · {t('payments.receipt')}
        </ComingSoon>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={t('reports.outstanding')} />
          {outstanding.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noOverdue')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('billing.invoiceNumber')}</TH>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('tenant.title')}</TH>
                  <TH>{t('billing.dueDate')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH numeric>{t('billing.total')}</TH>
                  <TH numeric>{t('billing.paid')}</TH>
                  <TH numeric>{t('billing.outstanding')}</TH>
                </tr>
              }
            >
              {outstanding.map((invoice) => (
                <tr key={invoice.invoice_id}>
                  <TD className="text-caption font-mono">{invoice.invoice_number}</TD>
                  <TD>
                    <Link
                      href={`/rooms/${invoice.room_id}`}
                      className="text-brand-blue-deep font-medium underline"
                    >
                      {invoice.room_number}
                    </Link>
                  </TD>
                  <TD>{invoice.tenant_name ?? '-'}</TD>
                  <TD>
                    {formatDate(invoice.due_date, typedLocale)}
                    {invoice.days_overdue > 0 ? (
                      <Badge tone="red" className="ml-1.5">
                        {t('dashboard.daysOverdue', { days: invoice.days_overdue })}
                      </Badge>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge tone={INVOICE_TONE[invoice.status]}>
                      {t(`invoiceStatus.${invoice.status}`)}
                    </Badge>
                  </TD>
                  <TD numeric>{formatTHB(invoice.total, typedLocale)}</TD>
                  <TD numeric>{formatTHB(invoice.paid_amount, typedLocale)}</TD>
                  <TD numeric className="font-medium">
                    {formatTHB(invoice.outstanding, typedLocale)}
                  </TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title={t('reports.collection')} />
          {collection.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('common.noData')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('common.month')}</TH>
                  <TH>{t('payments.method')}</TH>
                  <TH numeric>{t('common.total')}</TH>
                  <TH numeric>{t('common.amount')}</TH>
                </tr>
              }
            >
              {collection.map((row) => (
                <tr key={`${row.month}-${row.payment_method}`}>
                  <TD>{formatBillingMonth(row.month, typedLocale)}</TD>
                  <TD>{t(`paymentMethod.${row.payment_method}`)}</TD>
                  <TD numeric>{row.payment_count}</TD>
                  <TD numeric className="font-medium">
                    {formatTHB(row.total_amount, typedLocale)}
                  </TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
