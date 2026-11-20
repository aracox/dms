'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB, subtractMoney } from '@/lib/billing/money';
import { settleDepositAction, type SettleDepositState } from '@/lib/contracts/actions';
import { cn } from '@/lib/utils/cn';

interface SettlementProps {
  contractId: string;
  roomId: string;
  deposit: number;
  /** What the tenant still owes on their bills (amountOwed). */
  owed: number;
  locale: Locale;
}

/**
 * The actual refund and, when it is less than the deposit, why. The deduction
 * here is a preview -- settleDepositAction derives the stored figure from the
 * deposit it reads itself. Shared by the card form (room Contract tab) and the
 * table-row cells (deposits page) so both record a settlement the same way.
 *
 * When the tenant still owes money, the owner normally asks them to pay it, so
 * nothing is deducted by default. Ticking "pay from the deposit" lowers the
 * refund by what is owed and has settle_deposit mark those bills paid.
 */
function useDepositSettlement({ contractId, roomId, deposit, owed, locale }: SettlementProps) {
  const t = useTranslations();
  const [refund, setRefund] = useState(String(deposit));
  const [reason, setReason] = useState('');
  const [payBills, setPayBills] = useState(false);
  // Owing more than the deposit: it cannot clear the bills, the tenant pays the rest.
  const canPayBills = owed > 0 && owed <= deposit;
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
      if (payBills) formData.set('pay_bills', 'on');
      setState(await settleDepositAction({ error: null }, formData));
    });
  }

  const errorFor = (field: SettleDepositState['field']) =>
    state.field === field && state.error ? t(state.error) : undefined;

  function togglePayBills(checked: boolean) {
    setPayBills(checked);
    if (!checked) return;
    const afterBills = subtractMoney(deposit, owed);
    if (refund === '' || Number(refund) > afterBills) setRefund(String(afterBills));
    if (!reason.trim()) setReason(t('deposits.paidBillsReason'));
  }

  return {
    t,
    refund,
    setRefund,
    payBills,
    togglePayBills,
    canPayBills,
    owedNotice:
      owed > 0
        ? t(canPayBills ? 'deposits.owedWarning' : 'deposits.owedExceedsDeposit', {
            amount: formatTHB(owed, locale),
          })
        : null,
    payBillsLabel: t('deposits.payBillsFromDeposit', { amount: formatTHB(owed, locale) }),
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
      {s.canPayBills ? <PayBillsCheckbox s={s} /> : null}
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
      <TD className="w-56 align-top">
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
        {s.owedNotice ? (
          <p className="text-brand-yellow-deep text-caption mt-1 font-medium">{s.owedNotice}</p>
        ) : null}
        {s.canPayBills ? <PayBillsCheckbox s={s} className="mt-1" /> : null}
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

/** Opt-in: pay the tenant's unpaid bills out of the deposit as part of the settlement. */
function PayBillsCheckbox({
  s,
  className,
}: {
  s: ReturnType<typeof useDepositSettlement>;
  className?: string;
}) {
  return (
    <label className={cn('text-ink text-caption flex items-start gap-2', className)}>
      <input
        type="checkbox"
        checked={s.payBills}
        onChange={(event) => s.togglePayBills(event.target.checked)}
        disabled={s.isPending}
        className="accent-brand-blue mt-0.5 size-4 shrink-0 rounded-sm"
      />
      {s.payBillsLabel}
    </label>
  );
}
