'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { InlineEditableField } from '@/components/ui/InlineEditableField';
import type { Locale } from '@/i18n/routing';
import { updateTenantContactAction } from '@/lib/tenants/actions';
import { formatDate } from '@/lib/utils/date';
import type { ContractRow, TenantRow } from '@/types/database';

/** A field the tenant record fixes at move-in -- plain text with a lock, never clickable. */
function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="py-2">
      <dt className="text-ink-subtle text-caption flex items-center gap-1">
        <Lock size={11} aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-ink mt-0.5 text-sm font-medium">{value}</dd>
      {hint ? <p className="text-ink-subtle text-caption mt-0.5">{hint}</p> : null}
    </div>
  );
}

/**
 * The main-tenant card. Phone, LINE ID and emergency contact/phone edit in
 * place (click the value); everything else on the tenant record is fixed at
 * move-in and shown read-only with a lock icon.
 */
export function TenantContactCard({
  roomId,
  tenant,
  contract,
  locale,
  canEdit,
}: {
  roomId: string;
  tenant: TenantRow;
  contract: ContractRow;
  locale: Locale;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const [contact, setContact] = useState({
    phone: tenant.phone,
    line_id: tenant.line_id ?? '',
    emergency_contact: tenant.emergency_contact ?? '',
    emergency_phone: tenant.emergency_phone ?? '',
  });

  async function commitField(field: keyof typeof contact, value: string): Promise<string | null> {
    const next = { ...contact, [field]: value };

    const formData = new FormData();
    formData.set('tenant_id', tenant.id);
    formData.set('room_id', roomId);
    formData.set('phone', next.phone);
    formData.set('line_id', next.line_id);
    formData.set('emergency_contact', next.emergency_contact);
    formData.set('emergency_phone', next.emergency_phone);

    const result = await updateTenantContactAction({ error: null }, formData);
    if (result.error) return result.error;

    setContact(next);
    return null;
  }

  return (
    <Card>
      <CardHeader title={t('room.mainTenant')} description={t('tenant.singleTenantNotice')} />
      <CardBody>
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnlyField label={t('tenant.fullName')} value={tenant.full_name} />

          {canEdit ? (
            <InlineEditableField
              label={t('room.phone')}
              value={contact.phone}
              emptyLabel={t('common.notAvailable')}
              onCommit={(value) => commitField('phone', value)}
            />
          ) : (
            <ReadOnlyField
              label={t('room.phone')}
              value={
                <a href={`tel:${tenant.phone}`} className="text-brand-blue-deep underline">
                  {tenant.phone}
                </a>
              }
            />
          )}

          {canEdit ? (
            <InlineEditableField
              label={t('tenant.lineId')}
              value={contact.line_id}
              emptyLabel={t('common.notAvailable')}
              onCommit={(value) => commitField('line_id', value)}
            />
          ) : (
            <ReadOnlyField
              label={t('tenant.lineId')}
              value={tenant.line_id ?? t('common.notAvailable')}
            />
          )}

          <ReadOnlyField
            label={t('room.occupants')}
            value={t('room.occupantsValue', { count: contract.occupant_count })}
            hint={
              contract.occupant_count > 1
                ? t('room.additionalOccupants', { count: contract.occupant_count - 1 })
                : t('room.occupantsHint')
            }
          />
          <ReadOnlyField
            label={t('room.contractPeriod')}
            value={`${formatDate(contract.start_date, locale)} — ${formatDate(contract.end_date, locale)}`}
          />
          <ReadOnlyField label={t('room.paymentDueDay')} value={contract.payment_due_day} />

          {canEdit ? (
            <InlineEditableField
              label={t('tenant.emergencyContact')}
              value={contact.emergency_contact}
              emptyLabel={t('common.notAvailable')}
              onCommit={(value) => commitField('emergency_contact', value)}
            />
          ) : (
            <ReadOnlyField
              label={t('tenant.emergencyContact')}
              value={tenant.emergency_contact ?? t('common.notAvailable')}
            />
          )}

          {canEdit ? (
            <InlineEditableField
              label={t('tenant.emergencyPhone')}
              value={contact.emergency_phone}
              emptyLabel={t('common.notAvailable')}
              onCommit={(value) => commitField('emergency_phone', value)}
            />
          ) : (
            <ReadOnlyField
              label={t('tenant.emergencyPhone')}
              value={tenant.emergency_phone ?? t('common.notAvailable')}
            />
          )}
        </dl>
      </CardBody>
    </Card>
  );
}
