'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
      <Button type="button" variant="secondary" size="md" onClick={() => setOpen(true)}>
        + {t('billing.generateInvoice')}
      </Button>
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
            onChange={(event) => setMonth(event.target.value)}
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
        <form key={month} action={formAction} className="space-y-3">
          <input type="hidden" name="room_id" value={roomId} />
          <input type="hidden" name="billing_month" value={billingMonth} />

          <p className="text-ink-muted text-caption">{t('billing.extras')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {INVOICE_EXTRA_FEE_KEYS.map((key) => (
              <label key={key} className="text-ink text-body-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  name="extra"
                  value={key}
                  className="accent-brand-blue size-5 rounded-sm"
                />
                {t(EXTRA_FEE_LABEL_KEY[key])} · {formatTHB(fees[key] ?? 0, locale)}
              </label>
            ))}
          </div>

          <Button type="submit" variant="primary" size="md" disabled={isPending}>
            {isPending ? t('common.loading') : t('billing.generateInvoice')}
          </Button>

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
