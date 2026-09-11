import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { StaffManagement } from '@/components/staff/StaffManagement';
import type { Locale } from '@/i18n/routing';
import { getCurrentProfile } from '@/lib/supabase/server';
import { getStaffUsers } from '@/lib/users/queries';

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const t = await getTranslations();
  const [profile, users] = await Promise.all([getCurrentProfile(), getStaffUsers()]);

  return (
    <>
      <PageHeader title={t('staff.title')} description={t('staff.subtitle')} />
      <StaffManagement users={users} currentUserId={profile?.id ?? ''} locale={typedLocale} />
    </>
  );
}
