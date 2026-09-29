'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { RecordPaymentForm } from '@/components/room/RecordPaymentForm';
import { Button } from '@/components/ui/Button';
import { TD } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';

/**
 * One row of the payments page's outstanding list, with "record payment".
 * The form is too wide for a cell, so it opens in a full-width row right
 * under the bill -- the same RecordPaymentForm as the room's billing tab.
 */
export function OutstandingPaymentRow({
  children,
  columns,
  canRecord,
  roomId,
  invoiceId,
  outstanding,
  locale,
}: {
  /** The row's data cells; the action cell is added here. */
  children: ReactNode;
  /** Total column count including the action cell, for the form row's colSpan. */
  columns: number;
  canRecord: boolean;
  roomId: string;
  invoiceId: string;
  outstanding: number;
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr>
        {children}
        <TD>
          {canRecord && !open ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(true)}
              className="whitespace-nowrap"
            >
              + {t('payments.recordPayment')}
            </Button>
          ) : null}
        </TD>
      </tr>
      {open ? (
        <tr>
          <td colSpan={columns} className="bg-surface-muted px-4 pb-4">
            <RecordPaymentForm
              roomId={roomId}
              invoiceId={invoiceId}
              outstanding={outstanding}
              locale={locale}
              defaultOpen
              onClose={() => setOpen(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}
