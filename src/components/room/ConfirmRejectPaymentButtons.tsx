'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  confirmPaymentAction,
  rejectPaymentAction,
  type SetPaymentStatusState,
} from '@/lib/payments/actions';

const INITIAL_STATE: SetPaymentStatusState = { error: null };

/** Shown next to a pending payment row. Admin+ only, matching payments_update RLS. */
export function ConfirmRejectPaymentButtons({
  paymentId,
  roomId,
  invoiceId,
}: {
  paymentId: string;
  roomId: string;
  invoiceId: string;
}) {
  const t = useTranslations();
  const [confirmState, confirmAction, isConfirming] = useActionState(
    confirmPaymentAction,
    INITIAL_STATE,
  );
  const [rejectState, rejectAction, isRejecting] = useActionState(
    rejectPaymentAction,
    INITIAL_STATE,
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <form action={confirmAction}>
          <input type="hidden" name="payment_id" value={paymentId} />
          <input type="hidden" name="room_id" value={roomId} />
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <Button type="submit" variant="link" size="sm" disabled={isConfirming || isRejecting}>
            {isConfirming ? t('common.loading') : t('payments.confirm')}
          </Button>
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="payment_id" value={paymentId} />
          <input type="hidden" name="room_id" value={roomId} />
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <Button
            type="submit"
            variant="link"
            size="sm"
            disabled={isConfirming || isRejecting}
            className="text-brand-red-deep hover:text-brand-red-deep"
          >
            {isRejecting ? t('common.loading') : t('payments.reject')}
          </Button>
        </form>
      </div>

      {confirmState.error ? (
        <p className="text-brand-red-deep text-caption">{t(confirmState.error)}</p>
      ) : null}
      {rejectState.error ? (
        <p className="text-brand-red-deep text-caption">{t(rejectState.error)}</p>
      ) : null}
    </div>
  );
}
