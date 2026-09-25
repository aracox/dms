'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB, subtractMoney } from '@/lib/billing/money';
import { settleDepositAction, type SettleDepositState } from '@/lib/contracts/actions';

interface SettlementProps {
  contractId: string;
  roomId: string;
  deposit: number;
  locale: Locale;
}

/**
 * The actual refund and, when it is less than the deposit, why. The deduction
 * here is a preview -- settleDepositAction derives the stored figure from the
 * deposit it reads itself. Shared by the card form (room Contract tab) and the
 * table-row cells (deposits page) so both record a settlement the same way.
 */
function useDepositSettlement({ contractId, roomId, deposit, locale }: SettlementProps) {
  const t = useTranslations();
  const [refund, setRefund] = useState(String(deposit));
  const [reason, setReason] = useState('');
  const [state, setState] = useState<SettleDepositState>({ error: null });
  const [isPending, startTransition] = useTransition();

  const refundValue = Number(refund);
  const deduction =
    refund !== '' && Number.isFinite(refundValue) ? subtractMoney(deposit, refundValue) : 0;
  const hasDeduction = deduction > 0;

  function submit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('contract_id', contractId);
      formData.set('room_id', roomId);
      formData.set('refund', refund);
      formData.set('reason', reason);
      setState(await settleDepositAction({ error: null }, formData));
    });
  }

  const errorFor = (field: SettleDepositState['field']) =>
    state.field === field && state.error ? t(state.error) : undefined;

  return {
    t,
    refund,
    setRefund,
    reason,
    setReason,
    isPending,
    submit,
    hasDeduction,
    deduction,
    refundError: errorFor('refund'),
    reasonError: errorFor('reason'),
    generalError: state.error && !state.field ? t(state.error) : undefined,
    refundHint: hasDeduction
      ? t('contract.deductedPreview', {
          deposit: formatTHB(deposit, locale),
          amount: formatTHB(deduction, locale),
        })
      : t('contract.fullRefundHint', { deposit: formatTHB(deposit, locale) }),
  };
}

/** Stacked form, for the room's Contract tab card. */
export function DepositSettlementForm(props: SettlementProps) {
  const s = useDepositSettlement(props);
  const refundId = `refund-${props.contractId}`;
  const reasonId = `reason-${props.contractId}`;

  return (
    <div className="space-y-3">
      <FormField
        label={s.t('contract.actualRefund')}
        htmlFor={refundId}
        required
        hint={s.refundHint}
        error={s.refundError}
      >
        <Input
          id={refundId}
          type="number"
          min={0}
          max={props.deposit}
          step="0.01"
          value={s.refund}
          onChange={(event) => s.setRefund(event.target.value)}
          disabled={s.isPending}
          invalid={Boolean(s.refundError)}
        />
      </FormField>

      <FormField
        label={s.t('contract.deductionReason')}
        htmlFor={reasonId}
        required={s.hasDeduction}
        hint={s.hasDeduction ? s.t('contract.deductionReasonHint') : undefined}
        error={s.reasonError}
      >
        <Textarea
          id={reasonId}
          rows={2}
          maxLength={1000}
          value={s.reason}
          onChange={(event) => s.setReason(event.target.value)}
          disabled={s.isPending}
          invalid={Boolean(s.reasonError)}
        />
      </FormField>

      <Button variant="primary" size="sm" onClick={s.submit} disabled={s.isPending}>
        {s.isPending ? s.t('common.loading') : s.t('deposits.confirmRefunded')}
      </Button>

      {s.generalError ? (
        <p role="alert" className="text-brand-red-deep text-caption">
          {s.generalError}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The same settlement as three table cells -- refund, reason, confirm -- so a
 * row on the deposits page stays one line. Renders <td>s directly because a
 * <form> cannot span table cells.
 */
export function DepositSettlementCells(props: SettlementProps) {
  const s = useDepositSettlement(props);

  return (
    <>
      <TD className="w-40 align-top">
        <Input
          type="number"
          min={0}
          max={props.deposit}
          step="0.01"
          value={s.refund}
          onChange={(event) => s.setRefund(event.target.value)}
          disabled={s.isPending}
          invalid={Boolean(s.refundError)}
          aria-label={s.t('contract.actualRefund')}
          className="h-8 py-1"
        />
        {s.refundError ? (
          <p className="text-brand-red-deep text-caption mt-1">{s.refundError}</p>
        ) : s.hasDeduction ? (
          <p className="text-ink-muted text-caption mt-1">
            {s.t('deposits.deductedShort', { amount: formatTHB(s.deduction, props.locale) })}
          </p>
        ) : null}
      </TD>
      <TD className="min-w-56 align-top">
        <Input
          type="text"
          maxLength={1000}
          value={s.reason}
          onChange={(event) => s.setReason(event.target.value)}
          disabled={s.isPending}
          invalid={Boolean(s.reasonError)}
          aria-label={s.t('contract.deductionReason')}
          aria-required={s.hasDeduction}
          placeholder={s.hasDeduction ? s.t('contract.deductionReasonHint') : undefined}
          className="h-8 py-1"
        />
        {s.reasonError ? (
          <p className="text-brand-red-deep text-caption mt-1">{s.reasonError}</p>
        ) : null}
      </TD>
      <TD className="align-top">
        <Button
          variant="primary"
          size="sm"
          onClick={s.submit}
          disabled={s.isPending}
          className="whitespace-nowrap"
        >
          {s.isPending ? s.t('common.loading') : s.t('deposits.confirmRefunded')}
        </Button>
        {s.generalError ? (
          <p role="alert" className="text-brand-red-deep text-caption mt-1">
            {s.generalError}
          </p>
        ) : null}
      </TD>
    </>
  );
}
