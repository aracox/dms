import { Building2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import type { AppRole } from '@/types/database';

import { LocaleSwitcher } from './LocaleSwitcher';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';

/**
 * Desktop-first admin chrome: a fixed sidebar on wide screens, a horizontally
 * scrolling nav strip below `lg`.
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
    <div className="min-h-dvh">
      <header className="border-border bg-surface sticky top-0 z-10 border-b">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/dashboard" className="text-ink flex items-center gap-2">
            <span className="bg-brand-blue border-brand-blue-deep flex size-7 items-center justify-center rounded-md border text-white">
              <Building2 size={16} aria-hidden="true" />
            </span>
            <span className="font-display text-h4 font-semibold">{t('app.name')}</span>
          </Link>

          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <UserMenu name={profile.full_name} email={profile.email} role={profile.role} />
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        <aside className="border-border bg-surface shrink-0 border-b px-2 py-3 lg:sticky lg:top-[53px] lg:h-[calc(100dvh-53px)] lg:w-60 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Sidebar role={profile.role} />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-ink font-display text-h2">{title}</h1>
        {description ? <p className="text-ink-muted text-body-sm mt-1">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
