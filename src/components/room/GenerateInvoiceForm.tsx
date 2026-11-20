'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import {
  buildMonthlyInvoiceItems,
  invoiceItemAmount,
  invoiceTotals,
  rentForMonth,
  rentPeriodLabel,
} from '@/lib/billing/calc';
import { formatAmount, formatTHB } from '@/lib/billing/money';
import {
  contractEndedOn,
  contractsForBillingMonth,
  unbilledContracts,
} from '@/lib/contracts/status';
import { generateInvoiceAction, type GenerateInvoiceState } from '@/lib/invoices/actions';
import {
  finalMeterLabel,
  finalMeterUsage,
  hasFinalMeterNumber,
  type MeterContract,
  type UtilityMeter,
} from '@/lib/meters/tenancy';
import {
  EXTRA_FEE_LABEL_KEY,
  EXTRA_FEE_META,
  INVOICE_EXTRA_FEE_KEYS,
  type InvoiceExtraFeeKey,
} from '@/lib/invoices/fees';
import { currentBillingMonth, formatBillingMonth } from '@/lib/utils/date';
import type { ContractRow, MeterReadingRow } from '@/types/database';

const INITIAL_STATE: GenerateInvoiceState = { error: null };

type FormContract = MeterContract &
  Pick<ContractRow, 'id' | 'monthly_rent' | 'status' | 'start_date' | 'end_date' | 'terminated_at'>;
type LiveInvoice = { contract_id: string | null; billing_month: string };

/** The room's contracts for `billingMonth` and which of them still need a bill. */
function monthBilling(
  contracts: readonly FormContract[],
  liveInvoices: readonly LiveInvoice[],
  billingMonth: string,
) {
  const inMonth = contractsForBillingMonth(contracts, billingMonth);
  const toBill = unbilledContracts(contracts, liveInvoices, billingMonth);
  return { inMonth, toBill, fullyBilled: inMonth.length > 0 && toBill.length === 0 };
}

/**
 * Collapsed by default: a "+ Generate invoice" button reveals a month picker.
 * The button is disabled while every contract of the current month already
 * has a live bill. Picking a month that is fully billed shows a notice instead
 * of the form -- cancel or delete a bill below first, then generate again. In a
 * turnover month the outgoing and incoming tenant each get their own bill.
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
  rates,
  contracts,
  liveInvoices,
  subscribedKeys,
  meterReadings,
  locale,
}: {
  roomId: string;
  fees: Record<string, number>;
  /** The segment's utility rates: they price a move-out's usage, which has no reading. */
  rates: Record<UtilityMeter, number>;
  /** The room's contracts, newest first -- generate.ts bills each one covering the month. */
  contracts: readonly FormContract[];
  liveInvoices: readonly LiveInvoice[];
  /** Extra fees the room's contract currently subscribes to -- pre-checked so staff don't have to remember. */
  subscribedKeys: readonly string[];
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
    const thisMonthBilled = monthBilling(contracts, liveInvoices, thisMonth).fullyBilled;
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
  const { inMonth, toBill, fullyBilled } = monthBilling(contracts, liveInvoices, billingMonth);

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

      {fullyBilled ? (
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
              rates={rates}
              contracts={contracts}
              inMonth={inMonth}
              toBill={toBill}
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

/**
 * The bill(s) as they will be issued, with confirm (submits the form) and
 * back: prorated rent for each contract still to bill, and the month's
 * readings and ticked extras on the bill of the tenant in the room at month
 * end -- the rules generate.ts applies.
 */
function InvoiceReview({
  billingMonth,
  extras,
  fees,
  rates,
  contracts,
  inMonth,
  toBill,
  meterReadings,
  isPending,
  onBack,
  locale,
}: {
  billingMonth: string;
  extras: readonly InvoiceExtraFeeKey[];
  fees: Record<string, number>;
  rates: Record<UtilityMeter, number>;
  contracts: readonly FormContract[];
  inMonth: readonly FormContract[];
  toBill: readonly FormContract[];
  meterReadings: readonly Pick<
    MeterReadingRow,
    'billing_month' | 'meter_type' | 'previous_reading' | 'current_reading' | 'rate'
  >[];
  isPending: boolean;
  onBack: () => void;
  locale: Locale;
}) {
  const t = useTranslations();
  const monthEndContract = inMonth[0];
  // The same rules as generate.ts: a move-out's own usage, else the month's
  // reading on the month-end tenant's bill unless they left with final numbers.
  const reading = (type: UtilityMeter) => {
    const row = meterReadings.find(
      (candidate) => candidate.billing_month === billingMonth && candidate.meter_type === type,
    );
    return row && !(monthEndContract && hasFinalMeterNumber(monthEndContract, type, billingMonth))
      ? {
          previousReading: row.previous_reading,
          currentReading: row.current_reading,
          rate: row.rate,
          note: null,
        }
      : undefined;
  };
  const utility = (contract: FormContract, type: UtilityMeter) => {
    const final = finalMeterUsage({
      contract,
      type,
      billingMonth,
      readings: meterReadings,
      contracts,
    });
    if (final) {
      return { ...final, rate: rates[type], note: finalMeterLabel(final, contract.terminated_at!) };
    }
    return contract.id === monthEndContract?.id ? reading(type) : undefined;
  };

  const bills = toBill.map((contract) => {
    const rent = rentForMonth({
      monthlyRent: contract.monthly_rent,
      billingMonth,
      startDate: contract.start_date,
      endedOn: contractEndedOn(contract, contracts[contracts.indexOf(contract) - 1]),
    });
    const carriesReadings = contract.id === monthEndContract?.id;
    const electricity = utility(contract, 'electricity');
    const water = utility(contract, 'water');
    const rows = [
      ...buildMonthlyInvoiceItems({ monthlyRent: rent.amount, electricity, water }).map((item) => ({
        label: t(`invoiceItemType.${item.type}`),
        note:
          item.type === 'rent' && rent.days < rent.daysInMonth
            ? rentPeriodLabel(rent)
            : item.type === 'electricity'
              ? (electricity?.note ?? null)
              : item.type === 'water'
                ? (water?.note ?? null)
                : null,
        item,
      })),
      ...(carriesReadings ? extras : []).map((key) => ({
        label: t(EXTRA_FEE_LABEL_KEY[key]),
        note: null,
        item: { type: EXTRA_FEE_META[key].type, quantity: 1, unitPrice: fees[key] ?? 0 },
      })),
    ];
    return { contract, rows, total: invoiceTotals(rows.map((row) => row.item)).total };
  });
  const readingsBilled = toBill.some((contract) => contract.id === monthEndContract?.id);
  const missingReadings =
    readingsBilled && monthEndContract
      ? (['electricity', 'water'] as const)
          .filter((type) => !utility(monthEndContract, type))
          .map((type) => t(`invoiceItemType.${type}`))
      : [];

  return (
    <div className="border-border space-y-3 rounded-md border">
      <p className="text-ink font-display px-4 pt-3 font-semibold">
        {t('billing.reviewTitle', { month: formatBillingMonth(billingMonth, locale) })}
      </p>
      {bills.map(({ contract, rows, total }) => (
        <Table
          key={contract.id}
          head={
            <tr>
              <TH>{t('billing.description')}</TH>
              <TH numeric>{t('billing.quantity')}</TH>
              <TH numeric>{t('billing.unitPrice')}</TH>
              <TH numeric>{t('common.amount')}</TH>
            </tr>
          }
        >
          {rows.map(({ label, note, item }, index) => (
            <tr key={index}>
              <TD className="font-medium">
                {label}
                {note ? (
                  <span className="text-ink-subtle text-caption block font-normal">{note}</span>
                ) : null}
              </TD>
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
      ))}

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
