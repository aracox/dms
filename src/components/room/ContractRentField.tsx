'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { InlineEditableField } from '@/components/ui/InlineEditableField';
import { updateContractRentAction } from '@/lib/contracts/actions';

/** Corrects the active contract's monthly rent. Only future invoices are affected. */
export function ContractRentField({
  contractId,
  roomId,
  monthlyRent,
}: {
  contractId: string;
  roomId: string;
  monthlyRent: number;
}) {
  const t = useTranslations();
  const [rent, setRent] = useState(monthlyRent);

  async function commit(value: string): Promise<string | null> {
    const formData = new FormData();
    formData.set('contract_id', contractId);
    formData.set('room_id', roomId);
    formData.set('monthly_rent', value);

    const result = await updateContractRentAction({ error: null }, formData);
    if (result.error) return result.error;

    setRent(Number(value));
    return null;
  }

  return (
    <InlineEditableField
      label={t('room.monthlyRent')}
      value={String(rent)}
      emptyLabel={t('common.notAvailable')}
      onCommit={commit}
    />
  );
}
