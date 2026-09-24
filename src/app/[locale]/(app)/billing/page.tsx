import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BulkGenerateInvoicesButton } from '@/components/billing/BulkGenerateInvoicesButton';
import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { INVOICE_TONE } from '@/components/room/RoomBillingTab';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { compareBillingRooms } from '@/lib/billing/room-priority';
import { can } from '@/lib/permissions';
import { filterRoomsByView, parseSegmentView, propertySegment } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { formatBillingMonth } from '@/lib/utils/date';

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const view = parseSegmentView((await searchParams).segment);
  const profile = await getCurrentProfile();
  const canGenerate = can(profile?.role, 'invoices:write');
  const rooms = filterRoomsByView(view, await getRoomBoard({ includeTest: false }));
  // Every tile below derives from activeRooms, so they follow the filter too.
  const activeRooms = rooms
    .filter((room) => room.contract_status === 'active')
    .sort(compareBillingRooms);
  const totalOutstanding = activeRooms.reduce((sum, room) => sum + room.outstanding, 0);
  const overdueRooms = activeRooms.filter((room) => room.financial_status === 'overdue').length;
  // A tenant who moved in this month is not behind yet -- their first bill is next month's.
  const roomsWithoutInvoice = activeRooms.filter(
    (room) => room.invoice_id === null && room.financial_status !== 'first_month',
  ).length;

  return (
    <>
      <PageHeader
        title={t('billing.title')}
        description={t('billing.hubSubtitle')}
        action={<SegmentSwitcher current={view} pathname="/billing" />}
      />

      {canGenerate ? (
        <div className="mb-6">
          <BulkGenerateInvoicesButton />
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t('billing.activeRooms')} value={activeRooms.length} tone="blue" />
        <StatTile
          label={t('billing.outstanding')}
          value={formatTHB(totalOutstanding, typedLocale)}
          tone={totalOutstanding > 0 ? 'yellow' : 'green'}
        />
        <StatTile label={t('billing.overdueRooms')} value={overdueRooms} tone="red" />
        <StatTile label={t('billing.withoutInvoice')} value={roomsWithoutInvoice} />
      </div>

      <Card>
        <CardHeader
          title={t('billing.activeRooms')}
          description={t('rooms.subtitle', { count: activeRooms.length })}
        />
        {activeRooms.length === 0 ? (
          <div className="p-4">
            <EmptyState message={t('billing.noActiveContract')} />
          </div>
        ) : (
          <Table
            head={
              <tr>
                <TH>{t('room.roomNumber')}</TH>
                <TH>{t('segment.column')}</TH>
                <TH>{t('tenant.title')}</TH>
                <TH>{t('common.month')}</TH>
                <TH>{t('common.status')}</TH>
                <TH numeric>{t('billing.outstanding')}</TH>
                <TH>{t('common.actions')}</TH>
              </tr>
            }
          >
            {activeRooms.map((room) => {
              const billingHref = `/billing/${room.room_id}`;

              return (
                <tr key={room.room_id}>
                  <TD>
                    <Link
                      href={billingHref}
                      className="text-brand-blue-deep font-semibold underline"
                    >
                      {room.room_number}
                    </Link>
                  </TD>
                  <TD>
                    <SegmentBadge segment={propertySegment(room.room_type)} />
                  </TD>
                  <TD>{room.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD>
                    {room.billing_month
                      ? formatBillingMonth(room.billing_month, typedLocale)
                      : t('common.notAvailable')}
                  </TD>
                  <TD>
                    {room.invoice_status ? (
                      <Badge tone={INVOICE_TONE[room.invoice_status]}>
                        {t(`invoiceStatus.${room.invoice_status}`)}
                      </Badge>
                    ) : (
                      <span className="text-ink-subtle">{t('room.noInvoice')}</span>
                    )}
                  </TD>
                  <TD
                    numeric
                    className={room.outstanding > 0 ? 'font-semibold' : 'text-ink-subtle'}
                  >
                    {room.outstanding > 0
                      ? formatTHB(room.outstanding, typedLocale)
                      : t('common.notAvailable')}
                  </TD>
                  <TD>
                    <Link href={billingHref} className={buttonClasses('secondary', 'sm')}>
                      {t('billing.openBilling')}
                    </Link>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
