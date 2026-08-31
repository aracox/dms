'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
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
      <dt className="text-ink-subtle flex items-center gap-1 text-xs">
        <Lock size={11} aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-ink mt-0.5 text-sm font-medium">{value}</dd>
      {hint ? <p className="text-ink-subtle mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * A field that edits in place, DataTables-Editor style: click the value to
 * turn it into an input, Enter/blur commits, Escape reverts. No separate
 * "edit mode" for the whole card -- each field commits independently.
 */
function InlineEditableField({
  label,
  value,
  emptyLabel,
  onCommit,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  onCommit: (value: string) => Promise<string | null>;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  async function commit() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setPending(true);
    const nextError = await onCommit(draft);
    setPending(false);
    setError(nextError);
    if (!nextError) setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      inputRef.current?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      skipCommitRef.current = true;
      setDraft(value);
      inputRef.current?.blur();
    }
  }

  async function handleBlur() {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditing(false);
      setError(null);
      return;
    }
    await commit();
  }

  return (
    <div className="py-2">
      <dt className="text-ink-muted text-xs">{label}</dt>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="border-brand-blue bg-surface text-ink mt-0.5 w-full rounded-md border px-2 py-1 text-sm outline-none disabled:opacity-60"
        />
      ) : (
        <dd
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') startEditing();
          }}
          className="text-ink hover:bg-surface-sunken hover:ring-border -mx-1 mt-0.5 cursor-text rounded px-1 py-0.5 text-sm font-medium ring-1 ring-transparent"
        >
          {value || <span className="text-ink-subtle">{emptyLabel}</span>}
        </dd>
      )}
      {error ? <p className="text-brand-red-deep mt-0.5 text-xs">{t(error)}</p> : null}
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

  async function commitField(
    field: keyof typeof contact,
    value: string,
  ): Promise<string | null> {
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
