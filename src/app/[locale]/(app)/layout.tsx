import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { redirect } from '@/i18n/navigation';
import { getCurrentProfile } from '@/lib/supabase/server';

/**
 * Chrome for every authenticated page.
 *
 * The middleware already blocks anonymous requests; this second check exists
 * because a signed-in user without a profile row has no role, and every
 * permission check would silently deny.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active) {
    redirect({ href: '/login', locale });
    // redirect() throws; the return only narrows `profile` for TypeScript.
    return null;
  }

  return (
    <AppShell
      profile={{
        full_name: profile.full_name,
        role: profile.role,
        email: profile.email,
      }}
    >
      {children}
    </AppShell>
  );
}
