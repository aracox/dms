import { Download } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import type { RoomDetail } from '@/lib/rooms/queries';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { daysBetween, formatDate } from '@/lib/utils/date';
import type { ContractStatus } from '@/types/database';

import { TenantDocumentsCard, type TenantDocumentView } from './TenantDocumentsCard';

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

const CONTRACT_TONE: Record<ContractStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'green',
  expired: 'yellow',
  terminated: 'neutral',
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

  const daysRemaining = contract ? daysBetween(today, contract.end_date) : null;
  const profile = await getCurrentProfile();
  const canMoveIn = !contract && can(profile?.role, 'contracts:write');
  const canManageDocuments = can(profile?.role, 'tenants:write');
  const documents = tenant && canManageDocuments ? await loadTenantDocuments(tenant.id) : null;

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
                  className="border-border text-ink hover:bg-surface-sunken flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium"
                >
                  <Download size={12} aria-hidden="true" />
                  {t('contract.downloadPdf')}
                </Link>
              </div>
            ) : canMoveIn ? (
              <Link
                href={`/rooms/${detail.room.id}/move-in`}
                className="bg-brand-blue hover:bg-brand-blue-deep rounded-md px-3 py-1.5 text-xs font-semibold text-white"
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
              <Field label={t('tenant.lineId')} value={tenant.line_id ?? t('common.notAvailable')} />
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
              <Field
                label={t('room.monthlyRent')}
                value={formatTHB(contract.monthly_rent, locale)}
              />
              <Field label={t('room.deposit')} value={formatTHB(contract.deposit, locale)} />
              <Field label={t('room.paymentDueDay')} value={contract.payment_due_day} />
            </FieldGrid>
          ) : (
            <EmptyState message={t('room.noContract')} />
          )}
        </CardBody>
      </Card>

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
              </tr>
            }
          >
            {contractHistory.map((row) => (
              <tr key={row.id}>
                <TD>{formatDate(row.start_date, locale)}</TD>
                <TD>{formatDate(row.end_date, locale)}</TD>
                <TD numeric>{formatTHB(row.monthly_rent, locale)}</TD>
                <TD numeric>{row.occupant_count}</TD>
                <TD>
                  <Badge tone={CONTRACT_TONE[row.status]}>
                    {t(`contractStatus.${row.status}`)}
                  </Badge>
                </TD>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
