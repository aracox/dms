'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  cancelInvoiceAction,
  deleteInvoiceAction,
  type CancelInvoiceState,
  type DeleteInvoiceState,
} from '@/lib/invoices/actions';

const CANCEL_INITIAL_STATE: CancelInvoiceState = { error: null };
const DELETE_INITIAL_STATE: DeleteInvoiceState = { error: null };

/** Cancel voids an invoice without destroying it; Delete removes it (refused if it has any payment). */
export function InvoiceActions({
  roomId,
  invoiceId,
  canCancel,
  canDelete,
}: {
  roomId: string;
  invoiceId: string;
  canCancel: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations();
  const [cancelState, cancelAction, isCancelling] = useActionState(
    cancelInvoiceAction,
    CANCEL_INITIAL_STATE,
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteInvoiceAction,
    DELETE_INITIAL_STATE,
  );

  // Both actions are one-way, so each asks once before it submits.
  const [confirming, setConfirming] = useState<'cancel' | 'delete' | null>(null);

  if (!canCancel && !canDelete) return null;

  if (confirming) {
    const isCancel = confirming === 'cancel';
    const isPending = isCancel ? isCancelling : isDeleting;
    return (
      <form
        action={isCancel ? cancelAction : deleteAction}
        className="flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <input type="hidden" name="room_id" value={roomId} />
        <span className="text-caption font-medium text-white">
          {t(isCancel ? 'billing.confirmCancelInvoice' : 'billing.confirmDeleteInvoice')}
        </span>
        <Button
          type="submit"
          variant="link"
          size="sm"
          disabled={isPending}
          className="text-brand-red-deep hover:text-brand-red-deep"
        >
          {isPending ? t('common.loading') : t('common.yes')}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => setConfirming(null)}>
          {t('common.no')}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {canCancel ? (
        <Button type="button" variant="link" size="sm" onClick={() => setConfirming('cancel')}>
          {t('billing.cancelInvoice')}
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setConfirming('delete')}
          className="text-brand-red-deep hover:text-brand-red-deep"
        >
          {t('common.delete')}
        </Button>
      ) : null}

      {cancelState.error ? (
        <p className="text-brand-red-deep text-caption">{t(cancelState.error)}</p>
      ) : null}
      {deleteState.error ? (
        <p className="text-brand-red-deep text-caption">{t(deleteState.error)}</p>
      ) : null}
    </div>
  );
}
