import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { Link } from '@/i18n/navigation';
import type { AppRole } from '@/types/database';

import { AppFrame } from './AppFrame';
import { AppLogo } from './AppLogo';
import { DesktopSidebar } from './DesktopSidebar';
import { GlassSettings } from './GlassSettings';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileNavigation } from './MobileNavigation';
import { RouteChangeIndicator } from './RouteChangeIndicator';
import { SidebarProvider } from './SidebarState';
import { UserMenu } from './UserMenu';

/**
 * Desktop-first admin chrome with a fixed sidebar on wide screens and a drawer
 * navigation below `lg`. The sidebar can be hidden/shown on desktop via
 * SidebarProvider's state, persisted in localStorage.
 */
export async function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: { full_name: string; role: AppRole; email: string | null };
}) {
  const t = await getTranslations();

  return (
    <SidebarProvider>
      <AppFrame>
        <a href="#main-content" className="skip-link">
          {t('nav.skipToContent')}
        </a>
        <header className="app-toolbar glass border-border sticky top-0 z-10 border-b">
          <div className="flex min-h-13 items-center justify-between gap-3 px-4 py-2 lg:px-6">
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <MobileNavigation role={profile.role} />
              <Link
                href="/dashboard"
                aria-label={t('app.name')}
                className="text-ink flex min-w-0 items-center gap-2"
              >
                <span className="lg:hidden">
                  <AppLogo size={24} />
                </span>
                <span className="font-display text-body-sm lg:text-ink-muted hidden truncate font-medium sm:inline">
                  {t('app.name')}
                </span>
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
              <LocaleSwitcher />
              <UserMenu name={profile.full_name} email={profile.email} role={profile.role} />
              <GlassSettings />
            </div>
          </div>
        </header>

        <div className="app-body flex flex-col lg:flex-row">
          <DesktopSidebar role={profile.role} />

          <main
            id="main-content"
            tabIndex={-1}
            className="app-workspace relative min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6"
          >
            {/* Covers the content only; the sidebar and toolbar never reload. */}
            <Suspense fallback={null}>
              <RouteChangeIndicator />
            </Suspense>
            {children}
          </main>
        </div>
      </AppFrame>
    </SidebarProvider>
  );
}

/** Standard page heading. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="text-backdrop min-w-0 rounded-md">
        <h1 className="text-ink font-display text-h2">{title}</h1>
        {description ? <p className="text-ink-muted text-caption mt-1">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
