import { Download } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { confirmedPaid, outstanding } from '@/lib/billing/calc';
import { formatTHB } from '@/lib/billing/money';
import { contractDisplayStatus, type ContractDisplayStatus } from '@/lib/contracts/status';
import { SUBSCRIPTION_FEE_KEYS } from '@/lib/invoices/fees';
import { can } from '@/lib/permissions';
import type { RoomDetail } from '@/lib/rooms/queries';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { addDays, daysBetween, formatDate } from '@/lib/utils/date';

import { ContractRentField } from './ContractRentField';
import { ContractSubscriptionsCard } from './ContractSubscriptionsCard';
import { RenewContractForm } from './RenewContractForm';
import { SettleDepositForm } from './SettleDepositForm';
import { TenantDocumentsCard, type TenantDocumentView } from './TenantDocumentsCard';

/** Best-effort: a missing name just falls back to blank rather than failing the tab. */
async function loadTenantName(tenantId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('full_name')
    .eq('id', tenantId)
    .maybeSingle();
  return data?.full_name ?? '';
}

/** Admin+ only: matches the tenant_documents RLS and the storage bucket's own policy. */
async function loadTenantDocuments(tenantId: string): Promise<TenantDocumentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenant_documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  const rows = data ?? [];
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from('tenant-documents')
        .createSignedUrl(row.storage_path, 3600);
      return {
        id: row.id,
        file_name: row.file_name,
        created_at: row.created_at,
        url: signed?.signedUrl ?? null,
      };
    }),
  );
  return withUrls;
}

const CONTRACT_TONE: Record<ContractDisplayStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'green',
  expired: 'yellow',
  terminated: 'neutral',
  awaiting_refund: 'yellow',
};

export async function RoomContractTab({
  detail,
  locale,
  today,
}: {
  detail: RoomDetail;
  locale: Locale;
  today: string;
}) {
  const t = await getTranslations();
  const { contract, tenant, contractHistory } = detail;

  const subscriptionFees = Object.fromEntries(
    SUBSCRIPTION_FEE_KEYS.map((key) => [
      key,
      typeof detail.settings[key] === 'number' ? (detail.settings[key] as number) : 0,
    ]),
  );

  const daysRemaining = contract ? daysBetween(today, contract.end_date) : null;

  // Defaults for a 1-year renewal, same as the move-in page's own default term.
  const renewalStartDate = contract ? addDays(contract.end_date, 1) : '';
  const [renewalYear, renewalMonth, renewalDay] = renewalStartDate.split('-').map(Number);
  const renewalEndDate = contract
    ? `${(renewalYear ?? 0) + 1}-${String(renewalMonth).padStart(2, '0')}-${String(
        renewalDay,
      ).padStart(2, '0')}`
    : '';
  const profile = await getCurrentProfile();
  const canMoveIn = !contract && can(profile?.role, 'contracts:write');
  const canEditContract = can(profile?.role, 'contracts:write');
  const canManageDocuments = can(profile?.role, 'tenants:write');
  const documents = tenant && canManageDocuments ? await loadTenantDocuments(tenant.id) : null;

  // Only the room's single most recent past contract prompts for settlement --
  // an older one left unsettled from before this feature existed should not
  // resurface, and a contract that ended via renewal (status 'expired') was
  // never actually vacated, so it never needs a refund.
  const mostRecentPast = contract
    ? contractHistory.find((row) => row.id !== contract.id)
    : contractHistory[0];
  const pendingSettlement =
    mostRecentPast && mostRecentPast.status === 'terminated' && !mostRecentPast.deposit_settled_at
      ? mostRecentPast
      : null;
  const settlementTenantName = pendingSettlement
    ? await loadTenantName(pendingSettlement.tenant_id)
    : '';
  const settlementOutstanding = pendingSettlement
    ? detail.invoices
        .filter((invoice) => invoice.contract_id === pendingSettlement.id)
        .reduce(
          (sum, invoice) => sum + outstanding(invoice.total, confirmedPaid(invoice.payments)),
          0,
        )
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('contract.title')}
          description={t('tenant.singleTenantNotice')}
          action={
            contract ? (
              <div className="flex items-center gap-2">
                <Badge tone={CONTRACT_TONE[contract.status]}>
                  {t(`contractStatus.${contract.status}`)}
                </Badge>
                <Link
                  href={`/rooms/${detail.room.id}/contract`}
                  className={buttonClasses('secondary', 'sm')}
                >
                  <Download size={12} aria-hidden="true" />
                  {t('contract.downloadPdf')}
                </Link>
              </div>
            ) : canMoveIn ? (
              <Link
                href={`/rooms/${detail.room.id}/move-in`}
                className={buttonClasses('primary', 'sm')}
              >
                {t('contract.moveIn')}
              </Link>
            ) : null
          }
        />
        <CardBody>
          {contract && tenant ? (
            <FieldGrid>
              <Field label={t('tenant.fullName')} value={tenant.full_name} />
              <Field label={t('room.phone')} value={tenant.phone} />
              <Field
                label={t('tenant.idCard')}
                value={tenant.id_card_or_passport ?? t('common.notAvailable')}
              />
              <Field
                label={t('tenant.lineId')}
                value={tenant.line_id ?? t('common.notAvailable')}
              />
              <Field
                label={t('contract.startDate')}
                value={formatDate(contract.start_date, locale)}
              />
              <Field
                label={t('contract.endDate')}
                value={formatDate(contract.end_date, locale)}
                hint={
                  daysRemaining === null
                    ? undefined
                    : daysRemaining < 0
                      ? t('dashboard.expired')
                      : daysRemaining === 0
                        ? t('dashboard.expiresToday')
                        : t('dashboard.daysRemaining', { days: daysRemaining })
                }
              />
              <Field
                label={t('room.occupants')}
                value={t('room.occupantsValue', { count: contract.occupant_count })}
                hint={t('room.occupantsHint')}
              />
              {canEditContract ? (
                <ContractRentField
                  contractId={contract.id}
                  roomId={detail.room.id}
                  monthlyRent={contract.monthly_rent}
                  locale={locale}
                />
              ) : (
                <Field
                  label={t('room.monthlyRent')}
                  value={formatTHB(contract.monthly_rent, locale)}
                />
              )}
              <Field label={t('room.deposit')} value={formatTHB(contract.deposit, locale)} />
              <Field label={t('room.paymentDueDay')} value={contract.payment_due_day} />
            </FieldGrid>
          ) : (
            <EmptyState message={t('room.noContract')} />
          )}
        </CardBody>
      </Card>

      {pendingSettlement && canEditContract ? (
        <SettleDepositForm
          contractId={pendingSettlement.id}
          roomId={detail.room.id}
          tenantName={settlementTenantName}
          terminatedAt={pendingSettlement.terminated_at ?? pendingSettlement.end_date}
          deposit={pendingSettlement.deposit}
          outstanding={settlementOutstanding}
          locale={locale}
        />
      ) : null}

      {contract && canEditContract ? (
        <RenewContractForm
          contractId={contract.id}
          roomId={detail.room.id}
          defaultStartDate={renewalStartDate}
          defaultEndDate={renewalEndDate}
          defaultMonthlyRent={contract.monthly_rent}
          defaultDeposit={contract.deposit}
          defaultPaymentDueDay={contract.payment_due_day}
          defaultOccupantCount={contract.occupant_count}
        />
      ) : null}

      {contract ? (
        <ContractSubscriptionsCard
          contractId={contract.id}
          roomId={detail.room.id}
          fees={subscriptionFees}
          active={detail.contractSubscriptions}
          canEdit={canEditContract}
          locale={locale}
        />
      ) : null}

      {tenant && documents ? (
        <TenantDocumentsCard
          tenantId={tenant.id}
          roomId={detail.room.id}
          documents={documents}
          locale={locale}
        />
      ) : null}

      {contractHistory.length > 1 ? (
        <Card>
          <CardHeader title={t('cards.history')} />
          <Table
            head={
              <tr>
                <TH>{t('contract.startDate')}</TH>
                <TH>{t('contract.endDate')}</TH>
                <TH numeric>{t('room.monthlyRent')}</TH>
                <TH numeric>{t('room.occupants')}</TH>
                <TH>{t('common.status')}</TH>
                <TH>{t('contract.settleDeposit')}</TH>
              </tr>
            }
          >
            {contractHistory.map((row) => {
              const displayStatus = contractDisplayStatus(row);
              return (
                <tr key={row.id}>
                  <TD>{formatDate(row.start_date, locale)}</TD>
                  <TD>{formatDate(row.end_date, locale)}</TD>
                  <TD numeric>{formatTHB(row.monthly_rent, locale)}</TD>
                  <TD numeric>{row.occupant_count}</TD>
                  <TD>
                    <Badge tone={CONTRACT_TONE[displayStatus]}>
                      {t(`contractStatus.${displayStatus}`)}
                    </Badge>
                  </TD>
                  <TD>
                    {row.deposit_refund !== null
                      ? t('contract.depositRefunded', {
                          amount: formatTHB(row.deposit_refund, locale),
                        })
                      : row.status === 'terminated'
                        ? '-'
                        : ''}
                  </TD>
                </tr>
              );
            })}
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
