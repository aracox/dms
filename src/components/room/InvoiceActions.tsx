'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

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

  if (!canCancel && !canDelete) return null;

  return (
    <div className="flex items-center gap-3">
      {canCancel ? (
        <form action={cancelAction}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <input type="hidden" name="room_id" value={roomId} />
          <button
            type="submit"
            disabled={isCancelling}
            className="text-ink-muted text-xs underline disabled:opacity-60"
          >
            {isCancelling ? t('common.loading') : t('billing.cancelInvoice')}
          </button>
        </form>
      ) : null}

      {canDelete ? (
        <form action={deleteAction}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <input type="hidden" name="room_id" value={roomId} />
          <button
            type="submit"
            disabled={isDeleting}
            className="text-brand-red-deep text-xs underline disabled:opacity-60"
          >
            {isDeleting ? t('common.loading') : t('common.delete')}
          </button>
        </form>
      ) : null}

      {cancelState.error ? (
        <p className="text-brand-red-deep text-xs">{t(cancelState.error)}</p>
      ) : null}
      {deleteState.error ? (
        <p className="text-brand-red-deep text-xs">{t(deleteState.error)}</p>
      ) : null}
    </div>
  );
}
