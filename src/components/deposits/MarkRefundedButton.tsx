'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import type { Locale } from '@/i18n/routing';
import { formatTHB, subtractMoney } from '@/lib/billing/money';
import { settleDepositAction } from '@/lib/contracts/actions';

/**
 * "Mark refunded" for one row of the pending-refunds list. Opens a small
 * confirm step with the deduction and a note, then settles through the same
 * action as the room's Contract tab, and like that form the deduction starts
 * at 0. The refund shown here is a preview only -- settleDepositAction
 * computes the stored figure.
 */
export function MarkRefundedButton({
  contractId,
  roomId,
  deposit,
  locale,
}: {
  contractId: string;
  roomId: string;
  deposit: number;
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [deduction, setDeduction] = useState('0');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = Math.max(0, subtractMoney(deposit, Number(deduction) || 0));

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('contract_id', contractId);
      formData.set('room_id', roomId);
      formData.set('deduction', deduction);
      formData.set('note', note);

      const result = await settleDepositAction({ error: null }, formData);
      setError(result.error);
      if (!result.error) setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap"
      >
        <CheckCircle2 size={14} aria-hidden="true" />
        {t('deposits.markRefunded')}
      </Button>
    );
  }

  return (
    <div className="w-64 space-y-2 text-left">
      <FormField label={t('contract.deduction')} htmlFor={`deduction-${contractId}`}>
        <Input
          id={`deduction-${contractId}`}
          type="number"
          min={0}
          max={deposit}
          step="0.01"
          value={deduction}
          onChange={(event) => setDeduction(event.target.value)}
          disabled={isPending}
        />
      </FormField>
      <FormField label={t('common.note')} htmlFor={`note-${contractId}`}>
        <Input
          id={`note-${contractId}`}
          type="text"
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={isPending}
        />
      </FormField>
      <p className="text-ink text-caption">
        {t('deposits.refundPreview', { amount: formatTHB(preview, locale) })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={confirm} disabled={isPending}>
          {isPending ? t('common.loading') : t('deposits.confirmRefunded')}
        </Button>
        <Button variant="link" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
          {t('common.cancel')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-brand-red-deep text-caption">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
