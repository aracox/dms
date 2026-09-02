'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
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
      <Link href="/profile" className="hidden text-right sm:block sm:hover:opacity-75">
        <p className="text-ink text-caption font-medium">{name || email}</p>
        <p className="text-ink-subtle text-[11px]">{t(`roles.${role}`)}</p>
      </Link>

      <form action={signOutAction}>
        <Button type="submit" variant="secondary" size="sm">
          <LogOut size={13} aria-hidden="true" />
          {t('common.signOut')}
        </Button>
      </form>
    </div>
  );
}
