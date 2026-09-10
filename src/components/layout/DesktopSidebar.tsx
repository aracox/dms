'use client';

import { Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import type { AppRole } from '@/types/database';

import { Sidebar } from './Sidebar';
import { SidebarToggleButton } from './SidebarToggleButton';
import { useSidebar } from './SidebarState';

export function DesktopSidebar({ role }: { role: AppRole | null }) {
  const t = useTranslations();
  const { hidden } = useSidebar();

  return (
    <aside className={cn('app-sidebar hidden shrink-0 py-6 lg:block', hidden ? 'px-2' : 'px-4')}>
      <div
        className={cn('mb-9 flex items-center gap-2', hidden ? 'flex-col' : 'justify-between px-3')}
      >
        <Link
          href="/dashboard"
          aria-label={t('app.name')}
          className={cn(
            'flex min-w-0 items-center gap-2 text-sm font-semibold text-white',
            hidden && 'justify-center',
          )}
        >
          <Building2 size={19} aria-hidden="true" className="shrink-0" />
          {!hidden && t('app.name')}
        </Link>
        <SidebarToggleButton />
      </div>

      {!hidden && <Sidebar role={role} />}
    </aside>
  );
}
