'use client';

import { useTranslations } from 'next-intl';

import { InlineEditableField } from '@/components/ui/InlineEditableField';
import { updateContractOccupantsAction } from '@/lib/contracts/actions';
import { updateTenantContactAction } from '@/lib/tenants/actions';

/**
 * In-place editors for the tenant/contract details that can change after
 * move-in, shared by the Overview and Contract tabs.
 *
 * They show the value the server sent and keep no copy of their own: both tabs
 * are mounted at once, so a private copy would go stale the moment the other
 * tab saved. The actions revalidate the room page, which re-renders these with
 * the new value.
 */

type ContactField = 'phone' | 'line_id' | 'address' | 'emergency_contact' | 'emergency_phone';

export function TenantContactField({
  tenantId,
  roomId,
  field,
  label,
  value,
}: {
  tenantId: string;
  roomId: string;
  field: ContactField;
  label: string;
  value: string | null;
}) {
  const multiline = field === 'address';
  const t = useTranslations();

  async function commit(next: string): Promise<string | null> {
    const formData = new FormData();
    formData.set('tenant_id', tenantId);
    formData.set('room_id', roomId);
    // Only this field -- the action leaves the others untouched.
    formData.set(field, next);
    const result = await updateTenantContactAction({ error: null }, formData);
    return result.error;
  }

  return (
    <InlineEditableField
      label={label}
      value={value ?? ''}
      emptyLabel={t('common.notAvailable')}
      multiline={multiline}
      onCommit={commit}
    />
  );
}

export function ContractOccupantsField({
  contractId,
  roomId,
  count,
}: {
  contractId: string;
  roomId: string;
  count: number;
}) {
  const t = useTranslations();

  async function commit(next: string): Promise<string | null> {
    const formData = new FormData();
    formData.set('contract_id', contractId);
    formData.set('room_id', roomId);
    formData.set('occupant_count', next);
    const result = await updateContractOccupantsAction({ error: null }, formData);
    return result.error;
  }

  return (
    <InlineEditableField
      label={t('room.occupants')}
      value={String(count)}
      displayValue={t('room.occupantsValue', { count })}
      emptyLabel={t('common.notAvailable')}
      hint={occupantsHint(t, count)}
      inputType="number"
      onCommit={commit}
    />
  );
}

/** "Includes the main tenant" / "N additional occupants" -- occupant_count includes the tenant. */
export function occupantsHint(t: ReturnType<typeof useTranslations>, count: number): string {
  return count > 1 ? t('room.additionalOccupants', { count: count - 1 }) : t('room.occupantsHint');
}
