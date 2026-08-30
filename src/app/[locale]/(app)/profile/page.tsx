import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const profile = await getCurrentProfile();

  return (
    <>
      <PageHeader title={t('profile.title')} />

      <div className="space-y-4">
        <Card>
          <CardHeader title={t('auth.signedInAs')} />
          <CardBody>
            <FieldGrid>
              <Field label={t('tenant.fullName')} value={profile?.full_name || '-'} />
              <Field label={t('auth.email')} value={profile?.email ?? '-'} />
              <Field
                label={t('common.status')}
                value={profile ? t(`roles.${profile.role}`) : '-'}
              />
              <Field
                label={t('common.language')}
                value={(locale as Locale) === 'th' ? 'ไทย' : 'English'}
              />
            </FieldGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('auth.changePassword')} />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
