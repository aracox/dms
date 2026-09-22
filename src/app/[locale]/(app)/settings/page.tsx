import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { OwnerNamesForm } from '@/components/settings/OwnerNamesForm';
import { PaymentBankForm } from '@/components/settings/PaymentBankForm';
import { PropertyAddressForm } from '@/components/settings/PropertyAddressForm';
import { PropertyNamesForm } from '@/components/settings/PropertyNamesForm';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { formatAmount } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import { parseSegmentView, viewSegments } from '@/lib/reporting/segments';
import { SEGMENT_SETTING_KEYS, type SegmentSettingKey } from '@/lib/settings/segment-keys';
import {
  getOwnerNamesBySegment,
  getPaymentBanksBySegment,
  getPropertyAddressesBySegment,
  getPropertyNamesBySegment,
  getSettingsBySegment,
} from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';

/** These two keys are day counts, not money -- shown as plain integers. */
const DAY_COUNT_KEYS: readonly SegmentSettingKey[] = [
  'default_payment_due_day',
  'payment_grace_days',
];

/**
 * Rates, fees and defaults are per segment since migration 0025, and the
 * property name is per segment since migration 0030, so every figure and
 * name on this page belongs to either หอพัก or บ้านพัก. Only display currency
 * is whole-property, and it is not editable here.
 */
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const t = await getTranslations();
  const profile = await getCurrentProfile();
  const [values, propertyNames, ownerNames, paymentBanks, propertyAddresses] = await Promise.all([
    getSettingsBySegment(),
    getPropertyNamesBySegment(),
    getOwnerNamesBySegment(),
    getPaymentBanksBySegment(),
    getPropertyAddressesBySegment(),
  ]);
  const view = parseSegmentView((await searchParams).segment);
  const segments = viewSegments(view);

  const canWrite = can(profile?.role, 'settings:write');

  const readOnlyPropertyNames = (
    <Card>
      <CardHeader
        title={t('settings.propertyNames')}
        description={t('settings.propertyNamesHint')}
      />
      <CardBody>
        {segments.map((segment) => (
          <div key={segment} className="mb-4 last:mb-0">
            <h3 className="text-ink-muted font-display mb-2 text-[11px] tracking-[1px] uppercase">
              {t(`segment.${segment}`)}
            </h3>
            <FieldGrid>
              <Field label={t('settings.nameTh')} value={propertyNames[segment].name_th} />
              <Field label={t('settings.nameEn')} value={propertyNames[segment].name_en || '-'} />
            </FieldGrid>
          </div>
        ))}
      </CardBody>
    </Card>
  );

  const readOnlyOwnerNames = (
    <Card>
      <CardHeader title={t('settings.ownerNames')} description={t('settings.ownerNamesHint')} />
      <CardBody>
        {segments.map((segment) => (
          <div key={segment} className="mb-4 last:mb-0">
            <h3 className="text-ink-muted font-display mb-2 text-[11px] tracking-[1px] uppercase">
              {t(`segment.${segment}`)}
            </h3>
            <FieldGrid>
              <Field label={t('settings.nameTh')} value={ownerNames[segment].name_th || '-'} />
              <Field label={t('settings.nameEn')} value={ownerNames[segment].name_en || '-'} />
              <Field label={t('settings.idCard')} value={ownerNames[segment].id_card || '-'} />
              <Field label={t('settings.phone')} value={ownerNames[segment].phone || '-'} />
              <Field label={t('settings.address')} value={ownerNames[segment].address || '-'} />
            </FieldGrid>
          </div>
        ))}
      </CardBody>
    </Card>
  );

  const readOnlyPaymentBank = (
    <Card>
      <CardHeader title={t('settings.paymentBank')} description={t('settings.paymentBankHint')} />
      <CardBody>
        {segments.map((segment) => (
          <div key={segment} className="mb-4 last:mb-0">
            <h3 className="text-ink-muted font-display mb-2 text-[11px] tracking-[1px] uppercase">
              {t(`segment.${segment}`)}
            </h3>
            <FieldGrid>
              <Field
                label={t('settings.bankName')}
                value={paymentBanks[segment].bank_name || '-'}
              />
              <Field
                label={t('settings.accountNumber')}
                value={paymentBanks[segment].account_number || '-'}
              />
              <Field
                label={t('settings.accountName')}
                value={paymentBanks[segment].account_name || '-'}
              />
            </FieldGrid>
          </div>
        ))}
      </CardBody>
    </Card>
  );

  const readOnlyPropertyAddress = (
    <Card>
      <CardHeader
        title={t('settings.propertyAddress')}
        description={t('settings.propertyAddressHint')}
      />
      <CardBody>
        {segments.map((segment) => (
          <div key={segment} className="mb-4 last:mb-0">
            <h3 className="text-ink-muted font-display mb-2 text-[11px] tracking-[1px] uppercase">
              {t(`segment.${segment}`)}
            </h3>
            <FieldGrid>
              <Field label={t('settings.address')} value={propertyAddresses[segment] || '-'} />
            </FieldGrid>
          </div>
        ))}
      </CardBody>
    </Card>
  );

  /** Read-only rows: one label, then each segment's value. */
  const readOnlyGroup = (title: string, keys: readonly SegmentSettingKey[], labels: string[]) => (
    <Card>
      <CardHeader title={title} description={t('settings.perSegmentHint')} />
      <CardBody>
        {segments.map((segment) => (
          <div key={segment} className="mb-4 last:mb-0">
            <h3 className="text-ink-muted font-display mb-2 text-[11px] tracking-[1px] uppercase">
              {t(`segment.${segment}`)}
            </h3>
            <FieldGrid>
              {keys.map((key, index) => {
                const value = values[segment][key];
                return (
                  <Field
                    key={key}
                    label={labels[index]!}
                    value={
                      DAY_COUNT_KEYS.includes(key)
                        ? String(value)
                        : formatAmount(value, typedLocale)
                    }
                  />
                );
              })}
            </FieldGrid>
          </div>
        ))}
      </CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={canWrite ? t('settings.perSegmentHint') : t('settings.ownerOnly')}
        action={<SegmentSwitcher current={view} pathname="/settings" />}
      />

      {canWrite ? (
        <div className="space-y-4">
          <PropertyNamesForm values={propertyNames} view={view} />
          <PropertyAddressForm values={propertyAddresses} view={view} />
          <OwnerNamesForm values={ownerNames} view={view} />
          <PaymentBankForm values={paymentBanks} view={view} />
          <SettingsForm values={values} view={view} />
        </div>
      ) : (
        <div className="space-y-4">
          {readOnlyPropertyNames}
          {readOnlyPropertyAddress}
          {readOnlyOwnerNames}
          {readOnlyPaymentBank}

          {readOnlyGroup(t('settings.utilityRates'), SEGMENT_SETTING_KEYS.slice(0, 6), [
            t('meters.electricityRate'),
            t('meters.waterRate'),
            t('settings.defaultMonthlyRent'),
            t('settings.defaultDeposit'),
            t('settings.defaultPaymentDueDay'),
            t('settings.paymentGraceDays'),
          ])}

          {readOnlyGroup(t('settings.fees'), SEGMENT_SETTING_KEYS.slice(6, 11), [
            t('settings.internetFee'),
            t('settings.parkingFeeCar'),
            t('settings.parkingFeeMotorcycle'),
            t('settings.cardReplacementFee'),
            t('settings.lateFeePerDay'),
          ])}

          {readOnlyGroup(t('settings.streamingServices'), SEGMENT_SETTING_KEYS.slice(11), [
            t('settings.netflixFee'),
            t('settings.youtubeFee'),
            t('settings.disneyFee'),
            t('settings.viuFee'),
            t('settings.hboFee'),
            t('settings.amazonPrimeFee'),
          ])}
        </div>
      )}
    </>
  );
}
