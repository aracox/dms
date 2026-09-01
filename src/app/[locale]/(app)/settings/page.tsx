import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { can } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase.from('settings').select('key, value, description');

  const raw = (key: string) => settings?.find((row) => row.key === key)?.value;

  const display = (key: string) => {
    const found = raw(key);
    return found === undefined || found === null ? t('common.notAvailable') : String(found);
  };

  const canWrite = can(profile?.role, 'settings:write');

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={canWrite ? undefined : t('settings.ownerOnly')}
      />

      {canWrite ? (
        <SettingsForm
          values={{
            electricity_rate: Number(raw('electricity_rate') ?? 0),
            water_rate: Number(raw('water_rate') ?? 0),
            internet_fee: Number(raw('internet_fee') ?? 0),
            parking_fee_car: Number(raw('parking_fee_car') ?? 0),
            parking_fee_motorcycle: Number(raw('parking_fee_motorcycle') ?? 0),
            card_replacement_fee: Number(raw('card_replacement_fee') ?? 0),
            default_monthly_rent: Number(raw('default_monthly_rent') ?? 0),
            default_payment_due_day: Number(raw('default_payment_due_day') ?? 1),
            payment_grace_days: Number(raw('payment_grace_days') ?? 0),
          }}
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('settings.utilityRates')} description={t('meters.title')} />
            <CardBody>
              <FieldGrid>
                <Field label={t('meters.electricityRate')} value={display('electricity_rate')} />
                <Field label={t('meters.waterRate')} value={display('water_rate')} />
                <Field
                  label={t('settings.defaultMonthlyRent')}
                  value={display('default_monthly_rent')}
                />
                <Field
                  label={t('settings.defaultPaymentDueDay')}
                  value={display('default_payment_due_day')}
                />
                <Field
                  label={t('settings.paymentGraceDays')}
                  value={display('payment_grace_days')}
                />
              </FieldGrid>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('settings.fees')} />
            <CardBody>
              <FieldGrid>
                <Field label={t('settings.internetFee')} value={display('internet_fee')} />
                <Field label={t('settings.parkingFeeCar')} value={display('parking_fee_car')} />
                <Field
                  label={t('settings.parkingFeeMotorcycle')}
                  value={display('parking_fee_motorcycle')}
                />
                <Field
                  label={t('settings.cardReplacementFee')}
                  value={display('card_replacement_fee')}
                />
              </FieldGrid>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
