'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { buildMonthlyInvoiceItems, invoiceItemAmount, invoiceTotals } from '@/lib/billing/calc';
import { formatAmount, formatTHB } from '@/lib/billing/money';
import { generateInvoiceAction, type GenerateInvoiceState } from '@/lib/invoices/actions';
import {
  EXTRA_FEE_LABEL_KEY,
  EXTRA_FEE_META,
  INVOICE_EXTRA_FEE_KEYS,
  type InvoiceExtraFeeKey,
} from '@/lib/invoices/fees';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import type { MeterReadingRow } from '@/types/database';

const INITIAL_STATE: GenerateInvoiceState = { error: null };

/**
 * Collapsed by default: a "+ Generate invoice" button reveals a month picker.
 * The button is disabled while the current month already has a live invoice.
 * Picking a month that already has a live invoice shows a notice instead of
 * the form -- cancel or delete that invoice below first, then generate again.
 *
 * Issuing is two steps: the first click shows a review of the bill (rent,
 * that month's meter readings, the ticked extras, total) and only "confirm"
 * submits. The review is built with buildMonthlyInvoiceItems, the same
 * function generate.ts uses, so it matches what the server will write -- it is
 * still a preview; the database computes the stored totals.
 */
export function GenerateInvoiceForm({
  roomId,
  fees,
  liveInvoiceMonths,
  subscribedKeys,
  monthlyRent,
  meterReadings,
  locale,
}: {
  roomId: string;
  fees: Record<string, number>;
  liveInvoiceMonths: readonly string[];
  /** Extra fees the room's contract currently subscribes to -- pre-checked so staff don't have to remember. */
  subscribedKeys: readonly string[];
  /** The active contract's rent -- what generate.ts bills. */
  monthlyRent: number;
  meterReadings: readonly Pick<
    MeterReadingRow,
    'billing_month' | 'meter_type' | 'previous_reading' | 'current_reading' | 'rate'
  >[];
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => currentBillingMonth().slice(0, 7));
  const [state, formAction, isPending] = useActionState(generateInvoiceAction, INITIAL_STATE);
  // The extras ticked when "issue" was clicked; non-null means we are reviewing.
  const [reviewExtras, setReviewExtras] = useState<InvoiceExtraFeeKey[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    // This month is already billed: nothing to issue until that bill is
    // cancelled, so say so up front instead of after opening the picker.
    const thisMonth = currentBillingMonth();
    const thisMonthBilled = liveInvoiceMonths.includes(thisMonth);
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setOpen(true)}
          disabled={thisMonthBilled}
        >
          + {t('billing.generateInvoice')}
        </Button>
        {thisMonthBilled ? (
          <p className="text-ink-muted text-caption">
            {t('billing.invoiceAlreadyExistsHint', {
              month: formatBillingMonth(thisMonth, locale),
            })}
          </p>
        ) : null}
      </div>
    );
  }

  const billingMonth = `${month}-01`;
  const hasLiveInvoice = liveInvoiceMonths.includes(billingMonth);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-ink text-body-sm font-medium">
          {t('meters.billingMonth')}
          <Input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setReviewExtras(null);
            }}
            className="mt-1 block w-auto"
          />
        </label>
        <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
          {t('common.close')}
        </Button>
      </div>

      {hasLiveInvoice ? (
        <p className="text-ink-subtle text-caption">
          {t('billing.invoiceAlreadyExistsHint', {
            month: formatBillingMonth(billingMonth, locale),
          })}
        </p>
      ) : (
        <form key={month} ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="room_id" value={roomId} />
          <input type="hidden" name="billing_month" value={billingMonth} />

          {/* Hidden, not unmounted, while reviewing: the ticked boxes are what gets submitted. */}
          <div hidden={reviewExtras !== null} className="space-y-3">
            <p className="text-ink-muted text-caption">{t('billing.extras')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {INVOICE_EXTRA_FEE_KEYS.map((key) => (
                <label key={key} className="text-ink text-body-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="extra"
                    value={key}
                    defaultChecked={subscribedKeys.includes(key)}
                    className="accent-brand-blue size-5 rounded-sm"
                  />
                  {t(EXTRA_FEE_LABEL_KEY[key])} · {formatTHB(fees[key] ?? 0, locale)}
                </label>
              ))}
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                const ticked = new FormData(formRef.current ?? undefined).getAll('extra');
                setReviewExtras(ticked as InvoiceExtraFeeKey[]);
              }}
            >
              {t('billing.generateInvoice')}
            </Button>
          </div>

          {reviewExtras !== null ? (
            <InvoiceReview
              billingMonth={billingMonth}
              extras={reviewExtras}
              fees={fees}
              monthlyRent={monthlyRent}
              meterReadings={meterReadings}
              isPending={isPending}
              onBack={() => setReviewExtras(null)}
              locale={locale}
            />
          ) : null}

          {state.error ? (
            <p role="alert" className="text-brand-red-deep text-caption">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

/** The bill as it will be issued, with confirm (submits the form) and back. */
function InvoiceReview({
  billingMonth,
  extras,
  fees,
  monthlyRent,
  meterReadings,
  isPending,
  onBack,
  locale,
}: {
  billingMonth: string;
  extras: readonly InvoiceExtraFeeKey[];
  fees: Record<string, number>;
  monthlyRent: number;
  meterReadings: readonly Pick<
    MeterReadingRow,
    'billing_month' | 'meter_type' | 'previous_reading' | 'current_reading' | 'rate'
  >[];
  isPending: boolean;
  onBack: () => void;
  locale: Locale;
}) {
  const t = useTranslations();
  const reading = (type: 'electricity' | 'water') => {
    const row = meterReadings.find(
      (candidate) => candidate.billing_month === billingMonth && candidate.meter_type === type,
    );
    return row
      ? {
          previousReading: row.previous_reading,
          currentReading: row.current_reading,
          rate: row.rate,
        }
      : undefined;
  };
  const electricity = reading('electricity');
  const water = reading('water');

  const rows = [
    ...buildMonthlyInvoiceItems({ monthlyRent, electricity, water }).map((item) => ({
      label: t(`invoiceItemType.${item.type}`),
      item,
    })),
    ...extras.map((key) => ({
      label: t(EXTRA_FEE_LABEL_KEY[key]),
      item: { type: EXTRA_FEE_META[key].type, quantity: 1, unitPrice: fees[key] ?? 0 },
    })),
  ];
  const { total } = invoiceTotals(rows.map((row) => row.item));
  const missingReadings = [
    electricity ? null : t('invoiceItemType.electricity'),
    water ? null : t('invoiceItemType.water'),
  ].filter(Boolean);

  return (
    <div className="border-border space-y-3 rounded-md border">
      <p className="text-ink font-display px-4 pt-3 font-semibold">
        {t('billing.reviewTitle', { month: formatBillingMonth(billingMonth, locale) })}
      </p>
      <Table
        head={
          <tr>
            <TH>{t('billing.description')}</TH>
            <TH numeric>{t('billing.quantity')}</TH>
            <TH numeric>{t('billing.unitPrice')}</TH>
            <TH numeric>{t('common.amount')}</TH>
          </tr>
        }
      >
        {rows.map(({ label, item }, index) => (
          <tr key={index}>
            <TD className="font-medium">{label}</TD>
            <TD numeric>{formatAmount(item.quantity, locale)}</TD>
            <TD numeric>{formatAmount(item.unitPrice, locale)}</TD>
            <TD numeric>{formatTHB(invoiceItemAmount(item), locale)}</TD>
          </tr>
        ))}
        <tr>
          <TD className="font-semibold">{t('billing.total')}</TD>
          <TD />
          <TD />
          <TD numeric className="font-semibold">
            {formatTHB(total, locale)}
          </TD>
        </tr>
      </Table>

      <div className="space-y-2 px-4 pb-4">
        {missingReadings.length > 0 ? (
          <p className="text-brand-yellow-deep text-caption">
            {t('billing.reviewNoReading', { items: missingReadings.join(', ') })}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" size="md" disabled={isPending}>
            {isPending ? t('common.loading') : t('billing.confirmIssue')}
          </Button>
          <Button type="button" variant="link" size="md" onClick={onBack} disabled={isPending}>
            {t('billing.backToEdit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
