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

  // A Server Action's own redirect() lands here before the client picks up the
  // freshly-set session cookie on a fresh request, so this cannot be enforced
  // in middleware alone -- it must be re-checked on every render under (app).
  if (profile.must_change_password) {
    redirect({ href: '/change-password', locale });
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
