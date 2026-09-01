'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { generateInvoiceAction, type GenerateInvoiceState } from '@/lib/invoices/actions';
import { INVOICE_EXTRA_FEE_KEYS, type InvoiceExtraFeeKey } from '@/lib/invoices/fees';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';

const INITIAL_STATE: GenerateInvoiceState = { error: null };

/** Settings label key for each extra fee, reusing the existing Settings page copy. */
const EXTRA_FEE_LABEL_KEY: Record<InvoiceExtraFeeKey, string> = {
  internet_fee: 'settings.internetFee',
  parking_fee_car: 'settings.parkingFeeCar',
  parking_fee_motorcycle: 'settings.parkingFeeMotorcycle',
  card_replacement_fee: 'settings.cardReplacementFee',
  netflix_fee: 'settings.netflixFee',
  youtube_fee: 'settings.youtubeFee',
  disney_fee: 'settings.disneyFee',
  viu_fee: 'settings.viuFee',
  hbo_fee: 'settings.hboFee',
  amazon_prime_fee: 'settings.amazonPrimeFee',
};

/**
 * Collapsed by default: a "+ Generate invoice" button reveals a month picker.
 * Picking a month that already has a live invoice shows a notice instead of
 * the form -- cancel or delete that invoice below first, then generate again.
 */
export function GenerateInvoiceForm({
  roomId,
  fees,
  liveInvoiceMonths,
  locale,
}: {
  roomId: string;
  fees: Record<string, number>;
  liveInvoiceMonths: readonly string[];
  locale: Locale;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => currentBillingMonth().slice(0, 7));
  const [state, formAction, isPending] = useActionState(generateInvoiceAction, INITIAL_STATE);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border text-ink-muted hover:bg-surface-sunken rounded-md border px-3 py-2 text-sm"
      >
        + {t('billing.generateInvoice')}
      </button>
    );
  }

  const billingMonth = `${month}-01`;
  const hasLiveInvoice = liveInvoiceMonths.includes(billingMonth);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-ink-muted text-xs font-medium">
          {t('meters.billingMonth')}
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="border-border bg-surface text-ink mt-1 block rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-subtle text-xs underline"
        >
          {t('common.close')}
        </button>
      </div>

      {hasLiveInvoice ? (
        <p className="text-ink-subtle text-xs">
          {t('billing.invoiceAlreadyExistsHint', {
            month: formatBillingMonth(billingMonth, locale),
          })}
        </p>
      ) : (
        <form key={month} action={formAction} className="space-y-3">
          <input type="hidden" name="room_id" value={roomId} />
          <input type="hidden" name="billing_month" value={billingMonth} />

          <p className="text-ink-muted text-xs">{t('billing.extras')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {INVOICE_EXTRA_FEE_KEYS.map((key) => (
              <label key={key} className="text-ink flex items-center gap-2 text-sm">
                <input type="checkbox" name="extra" value={key} className="accent-brand-blue" />
                {t(EXTRA_FEE_LABEL_KEY[key])} · {formatTHB(fees[key] ?? 0, locale)}
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="bg-brand-blue hover:bg-brand-blue-deep rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending ? t('common.loading') : t('billing.generateInvoice')}
          </button>

          {state.error ? (
            <p role="alert" className="text-brand-red-deep text-xs">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
