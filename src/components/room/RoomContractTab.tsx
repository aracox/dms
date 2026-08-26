import { useTranslations } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { RoomDetail } from '@/lib/rooms/queries';
import { daysBetween, formatDate } from '@/lib/utils/date';
import type { ContractStatus } from '@/types/database';

const CONTRACT_TONE: Record<ContractStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'green',
  expired: 'yellow',
  terminated: 'neutral',
};

export function RoomContractTab({
  detail,
  locale,
  today,
}: {
  detail: RoomDetail;
  locale: Locale;
  today: string;
}) {
  const t = useTranslations();
  const { contract, tenant, contractHistory } = detail;

  const daysRemaining = contract ? daysBetween(today, contract.end_date) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('contract.title')}
          description={t('tenant.singleTenantNotice')}
          action={
            contract ? (
              <Badge tone={CONTRACT_TONE[contract.status]}>
                {t(`contractStatus.${contract.status}`)}
              </Badge>
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
