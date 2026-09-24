'use client';

import { useTranslations } from 'next-intl';

import { InlineEditableField } from '@/components/ui/InlineEditableField';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { updateContractRentAction } from '@/lib/contracts/actions';

/** Corrects the active contract's monthly rent. Only future invoices are affected. */
export function ContractRentField({
  contractId,
  roomId,
  monthlyRent,
  locale,
}: {
  contractId: string;
  roomId: string;
  monthlyRent: number;
  locale: Locale;
}) {
  const t = useTranslations();

  async function commit(value: string): Promise<string | null> {
    const formData = new FormData();
    formData.set('contract_id', contractId);
    formData.set('room_id', roomId);
    formData.set('monthly_rent', value);

    // No local copy of the rent: the action revalidates the room page, which
    // re-renders this with the saved value on whichever tab is showing it.
    const result = await updateContractRentAction({ error: null }, formData);
    return result.error;
  }

  return (
    <InlineEditableField
      label={t('room.monthlyRent')}
      value={String(monthlyRent)}
      displayValue={formatTHB(monthlyRent, locale)}
      emptyLabel={t('common.notAvailable')}
      onCommit={commit}
    />
  );
}
