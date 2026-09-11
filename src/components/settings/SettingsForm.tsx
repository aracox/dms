'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import { PROPERTY_SEGMENTS, viewSegments, type SegmentView } from '@/lib/reporting/segments';
import { updateSettingsAction, type SettingsState } from '@/lib/settings/actions';
import {
  segmentFieldName,
  type SegmentSettingKey,
  type SettingsBySegment,
} from '@/lib/settings/segment-keys';
import { cn } from '@/lib/utils/cn';
import type { PropertySegment } from '@/types/database';

const INITIAL_STATE: SettingsState = { message: null, error: null };

/**
 * One setting as a tile: label on top, one input per visible segment below.
 * Tiles sit in a grid rather than one full-width row per setting, so a card
 * of six settings reads as two or three short rows instead of a long
 * vertical list -- much better use of screen width above phone size.
 *
 * A segment the SegmentSwitcher has filtered out still renders, as a hidden
 * input carrying its current value, so submitting the filtered form does not
 * clobber it.
 */
function SettingTile({
  settingKey,
  label,
  values,
  segmentLabels,
  visibleSegments,
  step = '0.01',
}: {
  settingKey: SegmentSettingKey;
  label: string;
  values: SettingsBySegment;
  segmentLabels: Record<string, string>;
  visibleSegments: readonly PropertySegment[];
  step?: string;
}) {
  const showSegmentLabels = visibleSegments.length > 1;

  return (
    <div className="border-border rounded-md border p-3">
      <span className="text-ink text-body-sm mb-2 block font-medium">
        {label}
        <RequiredMark />
      </span>
      <div className={cn('grid gap-2', showSegmentLabels ? 'grid-cols-2' : 'grid-cols-1')}>
        {PROPERTY_SEGMENTS.map((segment) => {
          const name = segmentFieldName(segment, settingKey);
          // A segment filtered out of view still needs its value submitted
          // unchanged, or updateSettingsAction would read it as missing (0).
          if (!visibleSegments.includes(segment)) {
            return (
              <input key={segment} type="hidden" name={name} value={values[segment][settingKey]} />
            );
          }
          return (
            <div key={segment}>
              {showSegmentLabels ? (
                <span className="text-ink-subtle font-display mb-1 flex items-center gap-1 text-[10px] tracking-[1px] uppercase">
                  <span
                    className={cn('size-2 rounded-sm', SEGMENT_STYLES[segment].fill)}
                    aria-hidden="true"
                  />
                  {segmentLabels[segment]}
                </span>
              ) : null}
              <Input
                id={name}
                name={name}
                type="number"
                min={0}
                step={step}
                defaultValue={values[segment][settingKey]}
                required
                // Every tile shows its own label, but each input still needs its
                // own accessible name -- and the segment half must be translated.
                aria-label={`${label} (${segmentLabels[segment]})`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsForm({ values, view }: { values: SettingsBySegment; view: SegmentView }) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updateSettingsAction, INITIAL_STATE);

  const visibleSegments = viewSegments(view);
  const segmentLabels = Object.fromEntries(
    PROPERTY_SEGMENTS.map((segment) => [segment, t(`segment.${segment}`)]),
  );

  const tile = (settingKey: SegmentSettingKey, label: string, step?: string) => (
    <SettingTile
      key={settingKey}
      settingKey={settingKey}
      label={label}
      values={values}
      segmentLabels={segmentLabels}
      visibleSegments={visibleSegments}
      step={step}
    />
  );

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader title={t('settings.utilityRates')} description={t('settings.perSegmentHint')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tile('electricity_rate', t('meters.electricityRate'))}
            {tile('water_rate', t('meters.waterRate'))}
            {tile('default_monthly_rent', t('settings.defaultMonthlyRent'))}
            {tile('default_deposit', t('settings.defaultDeposit'))}
            {tile('default_payment_due_day', t('settings.defaultPaymentDueDay'), '1')}
            {tile('payment_grace_days', t('settings.paymentGraceDays'), '1')}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.fees')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tile('internet_fee', t('settings.internetFee'))}
            {tile('parking_fee_car', t('settings.parkingFeeCar'))}
            {tile('parking_fee_motorcycle', t('settings.parkingFeeMotorcycle'))}
            {tile('card_replacement_fee', t('settings.cardReplacementFee'))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.streamingServices')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tile('netflix_fee', t('settings.netflixFee'))}
            {tile('youtube_fee', t('settings.youtubeFee'))}
            {tile('disney_fee', t('settings.disneyFee'))}
            {tile('viu_fee', t('settings.viuFee'))}
            {tile('hbo_fee', t('settings.hboFee'))}
            {tile('amazon_prime_fee', t('settings.amazonPrimeFee'))}
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
