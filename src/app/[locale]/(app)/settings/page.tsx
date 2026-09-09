import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { can } from '@/lib/permissions';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { SEGMENT_SETTING_KEYS, type SegmentSettingKey } from '@/lib/settings/segment-keys';
import { getSettingsBySegment } from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';

/**
 * Rates, fees and defaults are per segment since migration 0025, so every
 * figure on this page belongs to either หอพัก or บ้านพัก. Only the property's
 * identity and display currency are whole-property, and neither is editable
 * here.
 */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const profile = await getCurrentProfile();
  const values = await getSettingsBySegment();

  const canWrite = can(profile?.role, 'settings:write');

  /** Read-only rows: one label, then each segment's value. */
  const readOnlyGroup = (title: string, keys: readonly SegmentSettingKey[], labels: string[]) => (
    <Card>
      <CardHeader title={title} description={t('settings.perSegmentHint')} />
      <CardBody>
        {PROPERTY_SEGMENTS.map((segment) => (
          <div key={segment} className="mb-4 last:mb-0">
            <h3 className="text-ink-muted font-display mb-2 text-[11px] tracking-[1px] uppercase">
              {t(`segment.${segment}`)}
            </h3>
            <FieldGrid>
              {keys.map((key, index) => (
                <Field key={key} label={labels[index]!} value={String(values[segment][key])} />
              ))}
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
      />

      {canWrite ? (
        <SettingsForm values={values} />
      ) : (
        <div className="space-y-4">
          {readOnlyGroup(t('settings.utilityRates'), SEGMENT_SETTING_KEYS.slice(0, 6), [
            t('meters.electricityRate'),
            t('meters.waterRate'),
            t('settings.defaultMonthlyRent'),
            t('settings.defaultDeposit'),
            t('settings.defaultPaymentDueDay'),
            t('settings.paymentGraceDays'),
          ])}

          {readOnlyGroup(t('settings.fees'), SEGMENT_SETTING_KEYS.slice(6, 10), [
            t('settings.internetFee'),
            t('settings.parkingFeeCar'),
            t('settings.parkingFeeMotorcycle'),
            t('settings.cardReplacementFee'),
          ])}

          {readOnlyGroup(t('settings.streamingServices'), SEGMENT_SETTING_KEYS.slice(10), [
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
