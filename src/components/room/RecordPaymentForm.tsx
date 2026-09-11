'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField, Input, Select } from '@/components/ui/Input';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { recordPaymentAction, type RecordPaymentState } from '@/lib/payments/actions';
import { bangkokToday } from '@/lib/utils/date';
import type { PaymentMethod } from '@/types/database';

const INITIAL_STATE: RecordPaymentState = { error: null };
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'promptpay'];

/** Collapsed by default: a "+ Record payment" button reveals the form. */
export function RecordPaymentForm({
  roomId,
  invoiceId,
  outstanding,
  locale,
}: {
  roomId: string;
  invoiceId: string;
  outstanding: number;
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(recordPaymentAction, INITIAL_STATE);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + {t('payments.recordPayment')}
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-border space-y-3 border-t pt-3">
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('payments.paymentDate')} htmlFor="payment_date">
          <Input
            id="payment_date"
            name="payment_date"
            type="date"
            defaultValue={bangkokToday()}
            required
          />
        </FormField>

        <FormField label={t('common.amount')} htmlFor="amount" hint={t('payments.maxAllowed', { amount: formatTHB(outstanding, locale) })}>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={0.01}
            max={outstanding}
            step="0.01"
            defaultValue={outstanding}
            required
          />
        </FormField>

        <FormField label={t('payments.method')} htmlFor="payment_method">
          <Select id="payment_method" name="payment_method" defaultValue="cash" required>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`paymentMethod.${method}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('common.status')} htmlFor="status">
          <Select id="status" name="status" defaultValue="confirmed">
            <option value="confirmed">{t('paymentStatus.confirmed')}</option>
            <option value="pending">{t('paymentStatus.pending')}</option>
          </Select>
        </FormField>

        <FormField label={t('payments.reference')} htmlFor="reference">
          <Input id="reference" name="reference" type="text" maxLength={100} />
        </FormField>

        <FormField label={t('payments.slip')} htmlFor="slip">
          <input
            id="slip"
            name="slip"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="text-body-sm"
          />
        </FormField>
      </div>

      <FormField label={t('common.note')} htmlFor="note">
        <Input id="note" name="note" type="text" maxLength={500} />
      </FormField>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" type="submit" disabled={isPending}>
          {isPending ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
          {t('common.close')}
        </Button>
      </div>

      {state.error ? (
        <p role="alert" className="text-brand-red-deep text-caption">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
