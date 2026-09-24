'use client';

import { CheckCircle2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { InlineEditableField } from '@/components/ui/InlineEditableField';
import type { Locale } from '@/i18n/routing';
import { updateContractOccupantsAction } from '@/lib/contracts/actions';
import { generateLineLinkCodeAction, updateTenantContactAction } from '@/lib/tenants/actions';
import { formatDate } from '@/lib/utils/date';
import type { ContractRow, TenantRow } from '@/types/database';

/** LINE link status: linked badge, a pending code with instructions, or a button to generate one. */
function LineLinkSection({
  tenantId,
  roomId,
  lineUserId,
  lineLinkCode,
}: {
  tenantId: string;
  roomId: string;
  lineUserId: string | null;
  lineLinkCode: string | null;
}) {
  const t = useTranslations();
  const [code, setCode] = useState(lineLinkCode);
  const [linked] = useState(Boolean(lineUserId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set('tenant_id', tenantId);
    formData.set('room_id', roomId);

    const result = await generateLineLinkCodeAction({ error: null, code: null }, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode(result.code);
  }

  return (
    <div className="py-2">
      <dt className="text-ink-subtle text-caption">{t('tenant.lineLink')}</dt>
      <dd className="mt-0.5">
        {linked ? (
          <Badge tone="green" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
            {t('tenant.lineLinked')}
          </Badge>
        ) : code ? (
          <div>
            <p className="text-ink font-mono text-lg font-semibold tracking-widest">{code}</p>
            <p className="text-ink-subtle text-caption mt-0.5">
              {t('tenant.lineLinkInstructions')}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={pending}
            >
              {t('tenant.regenerateLineLinkCode')}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={pending}
          >
            {t('tenant.generateLineLinkCode')}
          </Button>
        )}
        {error ? <p className="text-brand-red-deep text-caption mt-0.5">{t(error)}</p> : null}
      </dd>
    </div>
  );
}

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
 * The main-tenant card. Phone, LINE ID, emergency contact/phone and the
 * contract's occupant count edit in place (click the value); everything else
 * is fixed at move-in and shown read-only with a lock icon.
 */
export function TenantContactCard({
  roomId,
  tenant,
  contract,
  locale,
  canEdit,
  canEditContract,
}: {
  roomId: string;
  tenant: TenantRow;
  contract: ContractRow;
  locale: Locale;
  canEdit: boolean;
  canEditContract: boolean;
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

  const [occupants, setOccupants] = useState(contract.occupant_count);

  async function commitOccupants(value: string): Promise<string | null> {
    const formData = new FormData();
    formData.set('contract_id', contract.id);
    formData.set('room_id', roomId);
    formData.set('occupant_count', value);

    const result = await updateContractOccupantsAction({ error: null }, formData);
    if (result.error) return result.error;

    setOccupants(Number(value));
    return null;
  }

  const occupantsHint =
    occupants > 1
      ? t('room.additionalOccupants', { count: occupants - 1 })
      : t('room.occupantsHint');

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

          {canEditContract ? (
            <InlineEditableField
              label={t('room.occupants')}
              value={String(occupants)}
              displayValue={t('room.occupantsValue', { count: occupants })}
              emptyLabel={t('common.notAvailable')}
              hint={occupantsHint}
              inputType="number"
              onCommit={commitOccupants}
            />
          ) : (
            <ReadOnlyField
              label={t('room.occupants')}
              value={t('room.occupantsValue', { count: occupants })}
              hint={occupantsHint}
            />
          )}
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

          {canEdit ? (
            <LineLinkSection
              tenantId={tenant.id}
              roomId={roomId}
              lineUserId={tenant.line_user_id}
              lineLinkCode={tenant.line_link_code}
            />
          ) : (
            <ReadOnlyField
              label={t('tenant.lineLink')}
              value={tenant.line_user_id ? t('tenant.lineLinked') : t('common.notAvailable')}
            />
          )}
        </dl>
      </CardBody>
    </Card>
  );
}
