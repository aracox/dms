import {
  Banknote,
  CreditCard,
  DoorOpen,
  FileWarning,
  TrendingUp,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { MAINTENANCE_TONE, PRIORITY_TONE } from '@/components/room/RoomMaintenanceTab';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { getDashboardData } from '@/lib/reporting/queries';
import { formatDate } from '@/lib/utils/date';

/**
 * Every figure on this page comes from `lib/reporting`, which reads only the
 * report_* views. The T01 test room cannot appear here.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const { rooms, finance, tenants, expiring, maintenance, lostCards, overdue } =
    await getDashboardData();

  const money = (amount: number) => formatTHB(amount, typedLocale);

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle', { count: rooms.total_rooms })}
      />

      <section aria-labelledby="rooms-heading" className="mb-6">
        <h2 id="rooms-heading" className="text-ink-muted mb-2 text-sm font-semibold">
          {t('dashboard.rooms')}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label={t('dashboard.totalRooms')} value={rooms.total_rooms} tone="blue" />
          <StatTile label={t('dashboard.occupied')} value={rooms.occupied} tone="green" />
          <StatTile
            label={t('dashboard.vacant')}
            value={rooms.vacant}
            tone="neutral"
            icon={<DoorOpen size={14} aria-hidden="true" />}
          />
          <StatTile
            label={t('dashboard.maintenance')}
            value={rooms.maintenance}
            tone="yellow"
            icon={<Wrench size={14} aria-hidden="true" />}
          />
          <StatTile
            label={t('dashboard.occupancyRate')}
            value={`${rooms.occupancy_rate}%`}
            tone="blue"
            icon={<TrendingUp size={14} aria-hidden="true" />}
          />
        </div>
      </section>

      <section aria-labelledby="finance-heading" className="mb-6">
        <h2 id="finance-heading" className="text-ink-muted mb-2 text-sm font-semibold">
          {t('dashboard.finance')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t('dashboard.expectedRevenue')}
            value={money(finance.expected_rent)}
            hint={t('dashboard.expectedRevenueHint')}
            tone="blue"
          />
          <StatTile
            label={t('dashboard.collectedThisMonth')}
            value={money(finance.collected_this_month)}
            hint={t('dashboard.invoicedThisMonth') + ': ' + money(finance.invoiced_total)}
            tone="green"
            icon={<Banknote size={14} aria-hidden="true" />}
          />
          <StatTile
            label={t('dashboard.outstanding')}
            value={money(finance.outstanding)}
            tone="yellow"
          />
          <StatTile
            label={t('dashboard.overdue')}
            value={money(finance.overdue)}
            tone="red"
            icon={<TriangleAlert size={14} aria-hidden="true" />}
          />
        </div>
      </section>

      <section aria-labelledby="tenants-heading" className="mb-6">
        <h2 id="tenants-heading" className="text-ink-muted mb-2 text-sm font-semibold">
          {t('tenant.title')}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label={t('dashboard.registeredTenants')}
            value={tenants.registered_tenants}
            hint={t('tenant.singleTenantNotice')}
            tone="blue"
            icon={<Users size={14} aria-hidden="true" />}
          />
          <StatTile label={t('dashboard.totalOccupants')} value={tenants.total_occupants} />
          <StatTile
            label={t('dashboard.lostCards')}
            value={lostCards.length}
            tone={lostCards.length > 0 ? 'red' : 'neutral'}
            icon={<CreditCard size={14} aria-hidden="true" />}
          />
          <StatTile
            label={t('dashboard.openTickets')}
            value={maintenance.length}
            tone={maintenance.length > 0 ? 'yellow' : 'neutral'}
            icon={<Wrench size={14} aria-hidden="true" />}
          />
        </div>
      </section>

      <h2 className="text-ink-muted mb-2 text-sm font-semibold">{t('dashboard.operations')}</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={t('dashboard.paymentsDue')}
            action={
              <Link href="/payments" className="text-brand-blue-deep text-xs underline">
                {t('common.viewAll')}
              </Link>
            }
          />
          {overdue.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noOverdue')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('tenant.title')}</TH>
                  <TH>{t('billing.dueDate')}</TH>
                  <TH numeric>{t('billing.outstanding')}</TH>
                </tr>
              }
            >
              {overdue.map((invoice) => (
                <tr key={invoice.invoice_id}>
                  <TD>
                    <Link
                      href={`/rooms/${invoice.room_id}`}
                      className="text-brand-blue-deep font-medium underline"
                    >
                      {invoice.room_number}
                    </Link>
                  </TD>
                  <TD>{invoice.tenant_name ?? t('common.notAvailable')}</TD>
                  <TD>
                    {formatDate(invoice.due_date, typedLocale)}
                    <Badge tone="red" className="ml-1.5">
                      {t('dashboard.daysOverdue', { days: invoice.days_overdue })}
                    </Badge>
                  </TD>
                  <TD numeric className="font-medium">
                    {money(invoice.outstanding)}
                  </TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.contractsExpiring')} />
          {expiring.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noExpiringContracts')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('tenant.title')}</TH>
                  <TH>{t('contract.endDate')}</TH>
                  <TH numeric>{t('room.monthlyRent')}</TH>
                </tr>
              }
            >
              {expiring.map((contract) => (
                <tr key={contract.contract_id}>
                  <TD>
                    <Link
                      href={`/rooms/${contract.room_id}`}
                      className="text-brand-blue-deep font-medium underline"
                    >
                      {contract.room_number}
                    </Link>
                  </TD>
                  <TD>{contract.tenant_name}</TD>
                  <TD>
                    {formatDate(contract.end_date, typedLocale)}
                    <Badge
                      tone={contract.days_remaining <= 30 ? 'yellow' : 'neutral'}
                      className="ml-1.5"
                    >
                      {contract.days_remaining < 0
                        ? t('dashboard.expired')
                        : contract.days_remaining === 0
                          ? t('dashboard.expiresToday')
                          : t('dashboard.daysRemaining', { days: contract.days_remaining })}
                    </Badge>
                  </TD>
                  <TD numeric>{money(contract.monthly_rent)}</TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.openTickets')}
            action={
              <Link href="/maintenance" className="text-brand-blue-deep text-xs underline">
                {t('common.viewAll')}
              </Link>
            }
          />
          {maintenance.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noOpenTickets')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('maintenance.category')}</TH>
                  <TH>{t('maintenance.priority')}</TH>
                  <TH>{t('common.status')}</TH>
                </tr>
              }
            >
              {maintenance.map((ticket) => (
                <tr key={ticket.ticket_id}>
                  <TD>{ticket.room_number ?? t('maintenance.commonArea')}</TD>
                  <TD>{ticket.category}</TD>
                  <TD>
                    <Badge tone={PRIORITY_TONE[ticket.priority]}>
                      {t(`maintenancePriority.${ticket.priority}`)}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={MAINTENANCE_TONE[ticket.status]}>
                      {t(`maintenanceStatus.${ticket.status}`)}
                    </Badge>
                  </TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.lostCards')}
            action={
              <Link href="/access-cards" className="text-brand-blue-deep text-xs underline">
                {t('common.viewAll')}
              </Link>
            }
          />
          {lostCards.length === 0 ? (
            <div className="p-3">
              <EmptyState message={t('dashboard.noLostCards')} />
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <TH>{t('room.roomNumber')}</TH>
                  <TH>{t('cards.cardNumber')}</TH>
                  <TH>{t('cards.cardUid')}</TH>
                  <TH numeric>{t('cards.replacementFee')}</TH>
                </tr>
              }
            >
              {lostCards.map((card) => (
                <tr key={card.card_id}>
                  <TD>{card.room_number}</TD>
                  <TD>{card.card_number}</TD>
                  <TD className="text-ink-muted text-xs">{card.card_uid ?? '-'}</TD>
                  <TD numeric>{money(card.replacement_fee)}</TD>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <p className="text-ink-subtle mt-5 flex items-center gap-1.5 text-xs">
        <FileWarning size={13} aria-hidden="true" />
        {t('dashboard.testDataExcluded')}
      </p>
    </>
  );
}
