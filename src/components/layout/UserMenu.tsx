'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { signOutAction } from '@/lib/auth/actions';
import type { AppRole } from '@/types/database';

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string | null;
  role: AppRole;
}) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-ink text-xs font-medium">{name || email}</p>
        <p className="text-ink-subtle text-[11px]">{t(`roles.${role}`)}</p>
      </div>

      <form action={signOutAction}>
        <button
          type="submit"
          className="border-border text-ink-muted hover:bg-surface-sunken hover:text-ink flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium"
        >
          <LogOut size={13} aria-hidden="true" />
          {t('common.signOut')}
        </button>
      </form>
    </div>
  );
}
