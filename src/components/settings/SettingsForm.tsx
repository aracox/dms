'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { updateSettingsAction, type SettingsState } from '@/lib/settings/actions';

const INITIAL_STATE: SettingsState = { message: null, error: null };

export interface SettingsValues {
  electricity_rate: number;
  water_rate: number;
  internet_fee: number;
  parking_fee: number;
  card_replacement_fee: number;
  default_payment_due_day: number;
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
      <label htmlFor={name} className="text-ink-muted block text-xs font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        step={step}
        defaultValue={defaultValue}
        required
        className="border-border bg-surface text-ink mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
              name="default_payment_due_day"
              label={t('settings.defaultPaymentDueDay')}
              defaultValue={values.default_payment_due_day}
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
              name="parking_fee"
              label={t('settings.parkingFee')}
              defaultValue={values.parking_fee}
            />
            <NumberField
              name="card_replacement_fee"
              label={t('settings.cardReplacementFee')}
              defaultValue={values.card_replacement_fee}
            />
          </div>
        </CardBody>
      </Card>

      {state.error ? (
        <p
          role="alert"
          className="border-brand-red bg-brand-red-soft text-brand-red-deep rounded border px-3 py-2 text-xs"
        >
          {t(state.error)}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="border-brand-green bg-brand-green-soft text-brand-green-deep rounded border px-3 py-2 text-xs"
        >
          {t(state.message)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-blue hover:bg-brand-blue-deep rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? t('common.loading') : t('common.save')}
      </button>
    </form>
  );
}
