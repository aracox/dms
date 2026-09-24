'use client';

import { CheckCircle2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { generateLineLinkCodeAction, unlinkLineAction } from '@/lib/tenants/actions';
import { formatDate } from '@/lib/utils/date';
import type { ContractRow, TenantRow } from '@/types/database';

import { ContractPeriodField } from './ContractPeriodField';
import { ContractOccupantsField, occupantsHint, TenantContactField } from './EditableTenantFields';

/**
 * LINE link status: linked badge (with unlink, for a changed or wrong
 * account), a pending code with instructions, or a button to generate one.
 */
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
  const [linked, setLinked] = useState(Boolean(lineUserId));
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlink() {
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set('tenant_id', tenantId);
    formData.set('room_id', roomId);

    const result = await unlinkLineAction({ error: null }, formData);
    setPending(false);
    setConfirmingUnlink(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLinked(false);
    setCode(null);
  }

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
          confirmingUnlink ? (
            <div className="space-y-1">
              <p className="text-ink text-caption">{t('tenant.lineUnlinkConfirm')}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={pending}
                >
                  {pending ? t('common.loading') : t('tenant.lineUnlink')}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setConfirmingUnlink(false)}
                  disabled={pending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
                {t('tenant.lineLinked')}
              </Badge>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setConfirmingUnlink(true)}
              >
                {t('tenant.lineUnlink')}
              </Button>
            </div>
          )
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
 * The main-tenant card. Phone, LINE ID, emergency contact/phone, the LINE
 * link, and the contract's occupant count and period edit in place (click the
 * value); everything else is fixed at move-in and shown read-only with a lock.
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
  return (
    <Card>
      <CardHeader title={t('room.mainTenant')} description={t('tenant.singleTenantNotice')} />
      <CardBody>
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnlyField label={t('tenant.fullName')} value={tenant.full_name} />

          {canEdit ? (
            <TenantContactField
              tenantId={tenant.id}
              roomId={roomId}
              field="phone"
              label={t('room.phone')}
              value={tenant.phone}
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
            <TenantContactField
              tenantId={tenant.id}
              roomId={roomId}
              field="line_id"
              label={t('tenant.lineId')}
              value={tenant.line_id}
            />
          ) : (
            <ReadOnlyField
              label={t('tenant.lineId')}
              value={tenant.line_id ?? t('common.notAvailable')}
            />
          )}

          {canEditContract ? (
            <ContractOccupantsField
              contractId={contract.id}
              roomId={roomId}
              count={contract.occupant_count}
            />
          ) : (
            <ReadOnlyField
              label={t('room.occupants')}
              value={t('room.occupantsValue', { count: contract.occupant_count })}
              hint={occupantsHint(t, contract.occupant_count)}
            />
          )}
          {canEditContract ? (
            <ContractPeriodField
              contractId={contract.id}
              roomId={roomId}
              startDate={contract.start_date}
              endDate={contract.end_date}
              locale={locale}
            />
          ) : (
            <ReadOnlyField
              label={t('room.contractPeriod')}
              value={`${formatDate(contract.start_date, locale)} — ${formatDate(contract.end_date, locale)}`}
            />
          )}
          <ReadOnlyField label={t('room.paymentDueDay')} value={contract.payment_due_day} />

          {canEdit ? (
            <TenantContactField
              tenantId={tenant.id}
              roomId={roomId}
              field="emergency_contact"
              label={t('tenant.emergencyContact')}
              value={tenant.emergency_contact}
            />
          ) : (
            <ReadOnlyField
              label={t('tenant.emergencyContact')}
              value={tenant.emergency_contact ?? t('common.notAvailable')}
            />
          )}

          {canEdit ? (
            <TenantContactField
              tenantId={tenant.id}
              roomId={roomId}
              field="emergency_phone"
              label={t('tenant.emergencyPhone')}
              value={tenant.emergency_phone}
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
