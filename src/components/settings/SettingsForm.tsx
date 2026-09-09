'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { updateSettingsAction, type SettingsState } from '@/lib/settings/actions';
import {
  segmentFieldName,
  type SegmentSettingKey,
  type SettingsBySegment,
} from '@/lib/settings/segment-keys';
import { cn } from '@/lib/utils/cn';

const INITIAL_STATE: SettingsState = { message: null, error: null };

/**
 * One setting, with a field per segment side by side.
 *
 * Laid out as a row rather than two separate forms so the หอพัก and บ้านพัก
 * prices for the same thing sit next to each other -- the whole reason the
 * owner wanted them split is to compare and diverge them deliberately.
 */
function SegmentPair({
  settingKey,
  label,
  values,
  segmentLabels,
  step = '0.01',
}: {
  settingKey: SegmentSettingKey;
  label: string;
  values: SettingsBySegment;
  segmentLabels: Record<string, string>;
  step?: string;
}) {
  return (
    <div className="border-border grid grid-cols-1 items-end gap-3 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
      <span className="text-ink text-body-sm font-medium">
        {label}
        <RequiredMark />
      </span>
      {PROPERTY_SEGMENTS.map((segment) => {
        const name = segmentFieldName(segment, settingKey);
        return (
          <Input
            key={segment}
            id={name}
            name={name}
            type="number"
            min={0}
            step={step}
            defaultValue={values[segment][settingKey]}
            required
            // Visible headers exist per card, but each input still needs its own
            // accessible name -- and the segment half of it must be translated.
            aria-label={`${label} (${segmentLabels[segment]})`}
          />
        );
      })}
    </div>
  );
}

/** Column headers naming the two segments, above each card's rows. */
function SegmentHeadings({ labels }: { labels: Record<string, string> }) {
  return (
    <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_9rem_9rem] gap-3 sm:grid">
      <span />
      {PROPERTY_SEGMENTS.map((segment) => (
        <span
          key={segment}
          className="text-ink-muted font-display inline-flex items-center gap-1.5 text-[11px] tracking-[1px] uppercase"
        >
          <span
            className={cn('size-2.5 rounded-sm', SEGMENT_STYLES[segment].fill)}
            aria-hidden="true"
          />
          {labels[segment]}
        </span>
      ))}
    </div>
  );
}

export function SettingsForm({ values }: { values: SettingsBySegment }) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updateSettingsAction, INITIAL_STATE);

  const segmentLabels = Object.fromEntries(
    PROPERTY_SEGMENTS.map((segment) => [segment, t(`segment.${segment}`)]),
  );

  const pair = (settingKey: SegmentSettingKey, label: string, step?: string) => (
    <SegmentPair
      key={settingKey}
      settingKey={settingKey}
      label={label}
      values={values}
      segmentLabels={segmentLabels}
      step={step}
    />
  );

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader title={t('settings.utilityRates')} description={t('settings.perSegmentHint')} />
        <CardBody>
          <SegmentHeadings labels={segmentLabels} />
          <div className="space-y-3">
            {pair('electricity_rate', t('meters.electricityRate'))}
            {pair('water_rate', t('meters.waterRate'))}
            {pair('default_monthly_rent', t('settings.defaultMonthlyRent'))}
            {pair('default_deposit', t('settings.defaultDeposit'))}
            {pair('default_payment_due_day', t('settings.defaultPaymentDueDay'), '1')}
            {pair('payment_grace_days', t('settings.paymentGraceDays'), '1')}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.fees')} />
        <CardBody>
          <SegmentHeadings labels={segmentLabels} />
          <div className="space-y-3">
            {pair('internet_fee', t('settings.internetFee'))}
            {pair('parking_fee_car', t('settings.parkingFeeCar'))}
            {pair('parking_fee_motorcycle', t('settings.parkingFeeMotorcycle'))}
            {pair('card_replacement_fee', t('settings.cardReplacementFee'))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.streamingServices')} />
        <CardBody>
          <SegmentHeadings labels={segmentLabels} />
          <div className="space-y-3">
            {pair('netflix_fee', t('settings.netflixFee'))}
            {pair('youtube_fee', t('settings.youtubeFee'))}
            {pair('disney_fee', t('settings.disneyFee'))}
            {pair('viu_fee', t('settings.viuFee'))}
            {pair('hbo_fee', t('settings.hboFee'))}
            {pair('amazon_prime_fee', t('settings.amazonPrimeFee'))}
          </div>
        </CardBody>
      </Card>

      {state.error ? (
        <p
          role="alert"
          className="border-brand-red bg-brand-red-soft text-brand-red-deep text-caption rounded-md border px-3 py-2"
        >
          {t(state.error)}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="border-brand-green bg-brand-green-soft text-brand-green-deep text-caption rounded-md border px-3 py-2"
        >
          {t(state.message)}
        </p>
      ) : null}

      <Button variant="primary" size="md" type="submit" disabled={isPending}>
        {isPending ? t('common.loading') : t('common.save')}
      </Button>
    </form>
  );
}
