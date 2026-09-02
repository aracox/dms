'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import { updateSettingsAction, type SettingsState } from '@/lib/settings/actions';

const INITIAL_STATE: SettingsState = { message: null, error: null };

export interface SettingsValues {
  electricity_rate: number;
  water_rate: number;
  internet_fee: number;
  parking_fee_car: number;
  parking_fee_motorcycle: number;
  card_replacement_fee: number;
  netflix_fee: number;
  youtube_fee: number;
  disney_fee: number;
  viu_fee: number;
  hbo_fee: number;
  amazon_prime_fee: number;
  default_monthly_rent: number;
  default_deposit: number;
  default_payment_due_day: number;
  payment_grace_days: number;
}

function NumberField({
  name,
  label,
  defaultValue,
  step = '0.01',
}: {
  name: keyof SettingsValues;
  label: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-ink text-body-sm block font-medium">
        {label}
        <RequiredMark />
      </label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        step={step}
        defaultValue={defaultValue}
        required
        className="mt-1"
      />
    </div>
  );
}

export function SettingsForm({ values }: { values: SettingsValues }) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updateSettingsAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader title={t('settings.utilityRates')} description={t('meters.title')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              name="electricity_rate"
              label={t('meters.electricityRate')}
              defaultValue={values.electricity_rate}
            />
            <NumberField
              name="water_rate"
              label={t('meters.waterRate')}
              defaultValue={values.water_rate}
            />
            <NumberField
              name="default_monthly_rent"
              label={t('settings.defaultMonthlyRent')}
              defaultValue={values.default_monthly_rent}
            />
            <NumberField
              name="default_deposit"
              label={t('settings.defaultDeposit')}
              defaultValue={values.default_deposit}
            />
            <NumberField
              name="default_payment_due_day"
              label={t('settings.defaultPaymentDueDay')}
              defaultValue={values.default_payment_due_day}
              step="1"
            />
            <NumberField
              name="payment_grace_days"
              label={t('settings.paymentGraceDays')}
              defaultValue={values.payment_grace_days}
              step="1"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.fees')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              name="internet_fee"
              label={t('settings.internetFee')}
              defaultValue={values.internet_fee}
            />
            <NumberField
              name="parking_fee_car"
              label={t('settings.parkingFeeCar')}
              defaultValue={values.parking_fee_car}
            />
            <NumberField
              name="parking_fee_motorcycle"
              label={t('settings.parkingFeeMotorcycle')}
              defaultValue={values.parking_fee_motorcycle}
            />
            <NumberField
              name="card_replacement_fee"
              label={t('settings.cardReplacementFee')}
              defaultValue={values.card_replacement_fee}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.streamingServices')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              name="netflix_fee"
              label={t('settings.netflixFee')}
              defaultValue={values.netflix_fee}
            />
            <NumberField
              name="youtube_fee"
              label={t('settings.youtubeFee')}
              defaultValue={values.youtube_fee}
            />
            <NumberField
              name="disney_fee"
              label={t('settings.disneyFee')}
              defaultValue={values.disney_fee}
            />
            <NumberField
              name="viu_fee"
              label={t('settings.viuFee')}
              defaultValue={values.viu_fee}
            />
            <NumberField
              name="hbo_fee"
              label={t('settings.hboFee')}
              defaultValue={values.hbo_fee}
            />
            <NumberField
              name="amazon_prime_fee"
              label={t('settings.amazonPrimeFee')}
              defaultValue={values.amazon_prime_fee}
            />
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
