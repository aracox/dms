import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { OutstandingPaymentRow } from '@/components/payments/OutstandingPaymentRow';
import { PageHeader } from '@/components/layout/AppShell';
import { INVOICE_TONE } from '@/components/room/RoomBillingTab';
import { PAYMENT_TONE } from '@/components/room/RoomPaymentsTab';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthRoomFilter } from '@/components/ui/MonthRoomFilter';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import {
  getFirstPaymentMonth,
  getOutstandingInvoices,
  getPaymentsForMonth,
} from '@/lib/reporting/queries';
import { filterByView, filterRoomsByView, parseSegmentView } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { currentBillingMonth, formatBillingMonth, formatDate } from '@/lib/utils/date';
import {
  firstParam,
  monthRoomQuery,
  parseMonthParams,
  type SearchParam,
} from '@/lib/utils/month-filter';
import type { PaymentMethod } from '@/types/database';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'promptpay'];

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    segment?: SearchParam;
    year?: SearchParam;
    month?: SearchParam;
    room?: SearchParam;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const query = await searchParams;
  const view = parseSegmentView(query.segment);
  const currentMonth = currentBillingMonth();
  // The month the money arrived in, by payment date -- not the bill's month.
  const month = parseMonthParams(query.year, query.month, currentMonth) ?? currentMonth;
  const [wholeRooms, allPayments, firstPaymentMonth, allOutstanding, profile] = await Promise.all([
    getRoomBoard({ includeTest: false }),
    getPaymentsForMonth(month),
    getFirstPaymentMonth(),
    getOutstandingInvoices(),
    getCurrentProfile(),
  ]);
  const canRecord = can(profile?.role, 'payments:record');
  const rooms = filterRoomsByView(view, wholeRooms);
  // A room outside the current segment is ignored rather than showing an empty list.
  const roomFilter = rooms.find((room) => room.room_number === firstParam(query.room))?.room_number;
  const searchQuery = monthRoomQuery(month, currentMonth, roomFilter);
  const byRoom = <T extends { room_number: string }>(rows: T[]) =>
    roomFilter ? rows.filter((row) => row.room_number === roomFilter) : rows;

  // The tiles total the whole month in the segment; the room search narrows the tables.
  const payments = filterByView(view, allPayments);
  const confirmed = payments.filter((payment) => payment.status === 'confirmed');
  const pendingCount = payments.length - confirmed.length;
  const receivedBy = (method?: PaymentMethod) =>
    sumMoney(
      confirmed
        .filter((payment) => method === undefined || payment.payment_method === method)
        .map((payment) => payment.amount),
    );
  const listedPayments = byRoom(payments);
  // Unpaid bills are listed whatever their month, so the month search leaves them alone.
  const outstanding = byRoom(filterByView(view, allOutstanding));
  const monthLabel = formatBillingMonth(month, typedLocale);

  return (
    <>
      <PageHeader
        title={t('payments.title')}
        description={t('reports.subtitle')}
        action={<SegmentSwitcher current={view} pathname="/payments" query={searchQuery} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <StatTile
          label={t('payments.received')}
          value={formatTHB(receivedBy(), typedLocale)}
          hint={
            pendingCount > 0
              ? `${t('payments.paymentCount', { count: confirmed.length })} · ${t(
                  'payments.pendingNotCounted',
                  { count: pendingCount },
                )}`
              : t('payments.paymentCount', { count: confirmed.length })
          }
          tone="green"
        />
        {PAYMENT_METHODS.map((method) => (
          <StatTile
            key={method}
            label={t(`paymentMethod.${method}`)}
            value={formatTHB(receivedBy(method), typedLocale)}
          />
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={t('payments.historyFor', { month: monthLabel })} />
          <MonthRoomFilter
            label={t('payments.filterLabel')}
            pathname="/payments"
            month={month}
            defaultMonth={currentMonth}
            currentMonth={currentMonth}
            firstMonth={firstPaymentMonth ?? currentMonth}
            rooms={rooms}
            room={roomFilter}
            keep={view === 'all' ? {} : { segment: view }}
          />
          {listedPayments.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('payments.noPayments', { month: monthLabel })} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('payments.paymentDate')}</TH>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('tenant.title')}</TH>
                  <TH>{t('payments.billMonth')}</TH>
                  <TH>{t('payments.method')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH numeric>{t('common.amount')}</TH>
                  <TH>
                    <span className="sr-only">{t('payments.receipt')}</span>
                  </TH>
                </tr>
              }
            >
              {listedPayments.map((payment) => (
                <tr key={payment.payment_id}>
                  <TD className="whitespace-nowrap">
                    {formatDate(payment.payment_date, typedLocale)}
                  </TD>
                  <TD>
                    <Link
                      href={`/rooms/${payment.room_id}`}
                      className="text-brand-blue-deep font-medium underline"
                    >
                      {payment.room_number}
                    </Link>
                  </TD>
                  <TD>{payment.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD className="whitespace-nowrap">
                    {formatBillingMonth(payment.billing_month, typedLocale)}
                  </TD>
                  <TD>{t(`paymentMethod.${payment.payment_method}`)}</TD>
                  <TD>
                    <Badge tone={PAYMENT_TONE[payment.status]}>
                      {t(`paymentStatus.${payment.status}`)}
                    </Badge>
                  </TD>
                  <TD numeric className="font-medium">
                    {formatTHB(payment.amount, typedLocale)}
                  </TD>
                  <TD>
                    {payment.status === 'confirmed' ? (
                      <Link
                        href={`/payments/${payment.payment_id}/receipt`}
                        className="text-brand-blue-deep text-caption underline"
                      >
                        {t('payments.receipt')}
                      </Link>
                    ) : null}
                  </TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('reports.outstanding')}
            description={t('payments.outstandingAllMonths')}
          />
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
                  <TH>{t('segment.column')}</TH>
                  <TH>{t('tenant.title')}</TH>
                  <TH>{t('billing.dueDate')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH numeric>{t('billing.total')}</TH>
                  <TH numeric>{t('billing.paid')}</TH>
                  <TH numeric>{t('billing.outstanding')}</TH>
                  <TH>
                    <span className="sr-only">{t('payments.recordPayment')}</span>
                  </TH>
                </tr>
              }
            >
              {outstanding.map((invoice) => (
                // Keyed on the balance too, so a partial payment re-renders the
                // row closed with the new outstanding as the form's default.
                <OutstandingPaymentRow
                  key={`${invoice.invoice_id}-${invoice.outstanding}`}
                  columns={10}
                  canRecord={canRecord}
                  roomId={invoice.room_id}
                  invoiceId={invoice.invoice_id}
                  outstanding={invoice.outstanding}
                  locale={typedLocale}
                >
                  <TD className="text-caption font-mono">{invoice.invoice_number}</TD>
                  <TD>
                    <Link
                      href={`/rooms/${invoice.room_id}`}
                      className="text-brand-blue-deep font-medium underline"
                    >
                      {invoice.room_number}
                    </Link>
                  </TD>
                  <TD>
                    <SegmentBadge segment={invoice.property_segment} />
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
                </OutstandingPaymentRow>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
