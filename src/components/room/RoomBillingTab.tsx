import { getTranslations } from 'next-intl/server';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { confirmedPaid, outstanding } from '@/lib/billing/calc';
import { formatTHB } from '@/lib/billing/money';
import { INVOICE_EXTRA_FEE_KEYS } from '@/lib/invoices/fees';
import { can } from '@/lib/permissions';
import type { RoomDetail } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { formatBillingMonth, formatDate } from '@/lib/utils/date';
import type { InvoiceStatus } from '@/types/database';

import { GenerateInvoiceForm } from './GenerateInvoiceForm';
import { InvoiceActions } from './InvoiceActions';

export const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = {
  draft: 'neutral',
  issued: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  overdue: 'red',
  cancelled: 'neutral',
};

export async function RoomBillingTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = await getTranslations();
  const profile = await getCurrentProfile();

  const canGenerate = can(profile?.role, 'invoices:write') && Boolean(detail.contract);
  const canCancel = can(profile?.role, 'invoices:write');
  const canDeleteInvoices = can(profile?.role, 'invoices:delete');

  const liveInvoiceMonths = detail.invoices
    .filter((invoice) => invoice.status !== 'cancelled')
    .map((invoice) => invoice.billing_month);

  const fees = Object.fromEntries(
    INVOICE_EXTRA_FEE_KEYS.map((key) => [
      key,
      typeof detail.settings[key] === 'number' ? (detail.settings[key] as number) : 0,
    ]),
  );

  return (
    <div className="space-y-4">
      {canGenerate ? (
        <Card>
          <CardBody>
            <GenerateInvoiceForm
              roomId={detail.room.id}
              fees={fees}
              liveInvoiceMonths={liveInvoiceMonths}
              locale={locale}
            />
          </CardBody>
        </Card>
      ) : null}

      {detail.invoices.length === 0 ? <EmptyState message={t('room.noInvoice')} /> : null}

      {detail.invoices.map((invoice) => {
        const paid = confirmedPaid(invoice.payments);
        const hasPayments = invoice.payments.length > 0;

        return (
          <Card key={invoice.id}>
            <CardHeader
              title={`${invoice.invoice_number} · ${formatBillingMonth(invoice.billing_month, locale)}`}
              description={`${t('billing.dueDate')} ${formatDate(invoice.due_date, locale)}`}
              action={
                <div className="flex items-center gap-3">
                  <Badge tone={INVOICE_TONE[invoice.status]}>
                    {t(`invoiceStatus.${invoice.status}`)}
                  </Badge>
                  <InvoiceActions
                    roomId={detail.room.id}
                    invoiceId={invoice.id}
                    canCancel={canCancel && invoice.status !== 'cancelled'}
                    canDelete={canDeleteInvoices && !hasPayments}
                  />
                </div>
              }
            />

            <Table
              head={
                <tr>
                  <TH>{t('billing.description')}</TH>
                  <TH numeric>{t('billing.quantity')}</TH>
                  <TH numeric>{t('billing.unitPrice')}</TH>
                  <TH numeric>{t('common.amount')}</TH>
                </tr>
              }
            >
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <TD>
                    <span className="font-medium">{t(`invoiceItemType.${item.type}`)}</span>
                    {item.description ? (
                      <span className="text-ink-subtle block text-xs">{item.description}</span>
                    ) : null}
                  </TD>
                  <TD numeric>{item.quantity}</TD>
                  <TD numeric>{item.unit_price}</TD>
                  <TD numeric className="font-medium">
                    {item.type === 'discount' ? '-' : ''}
                    {formatTHB(item.amount, locale)}
                  </TD>
                </tr>
              ))}
            </Table>

            <CardBody className="border-border bg-surface-muted border-t">
              <dl className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{t('billing.subtotal')}</dt>
                  <dd className="tabular-nums">{formatTHB(invoice.subtotal, locale)}</dd>
                </div>
                {invoice.discount > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">{t('billing.discount')}</dt>
                    <dd className="tabular-nums">-{formatTHB(invoice.discount, locale)}</dd>
                  </div>
                ) : null}
                <div className="border-border flex justify-between gap-4 border-t pt-1 font-semibold">
                  <dt>{t('billing.total')}</dt>
                  <dd className="tabular-nums">{formatTHB(invoice.total, locale)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{t('billing.paid')}</dt>
                  <dd className="tabular-nums">{formatTHB(paid, locale)}</dd>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <dt>{t('billing.outstanding')}</dt>
                  <dd className="tabular-nums">
                    {formatTHB(outstanding(invoice.total, paid), locale)}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
