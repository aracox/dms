import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { can } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';

/** Read-only for now. Editing is owner-only and lands with Phase 11. */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase.from('settings').select('key, value, description');

  const value = (key: string) => {
    const found = settings?.find((row) => row.key === key)?.value;
    return found === undefined || found === null ? t('common.notAvailable') : String(found);
  };

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={can(profile?.role, 'settings:write') ? undefined : t('settings.ownerOnly')}
      />

      <div className="mb-4">
        <ComingSoon>
          {t('settings.title')} — {t('common.edit')}
        </ComingSoon>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={t('settings.utilityRates')} description={t('meters.title')} />
          <CardBody>
            <FieldGrid>
              <Field label={t('meters.electricityRate')} value={value('electricity_rate')} />
              <Field label={t('meters.waterRate')} value={value('water_rate')} />
              <Field
                label={t('settings.defaultPaymentDueDay')}
                value={value('default_payment_due_day')}
              />
            </FieldGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('settings.fees')} />
          <CardBody>
            <FieldGrid>
              <Field label={t('settings.internetFee')} value={value('internet_fee')} />
              <Field label={t('settings.parkingFee')} value={value('parking_fee')} />
              <Field
                label={t('settings.cardReplacementFee')}
                value={value('card_replacement_fee')}
              />
            </FieldGrid>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
