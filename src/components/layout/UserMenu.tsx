'use client';

import {
  ChevronDown,
  FlaskConical,
  LogOut,
  ScrollText,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';

import { Link } from '@/i18n/navigation';
import { signOutAction } from '@/lib/auth/actions';
import { can, type Permission } from '@/lib/permissions';
import type { AppRole } from '@/types/database';

import { ACCOUNT_NAV_ITEMS } from './nav-items';

const ICONS: Record<string, LucideIcon> = { Settings, FlaskConical, ScrollText, Users };

const ITEM_CLASSES =
  'font-display text-ink-muted hover:bg-surface-sunken hover:text-ink flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px]';

/**
 * Account menu: profile, the rarely visited system pages, and sign-out.
 *
 * Built on the native `popover` attribute, so the browser handles light
 * dismiss, Escape and the top layer; links close it explicitly because a
 * client-side navigation does not.
 */
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
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => menuRef.current?.hidePopover();

  const systemItems = ACCOUNT_NAV_ITEMS.filter(
    (item) => !item.permission || can(role, item.permission as Permission),
  );

  return (
    <>
      <button
        type="button"
        popoverTarget={menuId}
        aria-label={t('nav.accountMenu')}
        className="hover:bg-surface-sunken flex items-center gap-2 rounded-md px-1.5 py-1 text-right sm:px-2"
      >
        <span className="bg-brand-blue-soft text-brand-blue-deep flex size-7 shrink-0 items-center justify-center rounded-full sm:hidden">
          <User size={14} aria-hidden="true" />
        </span>
        <span className="hidden sm:block">
          <span className="text-ink text-caption block font-medium">{name || email}</span>
          <span className="text-ink-subtle block text-[11px]">{t(`roles.${role}`)}</span>
        </span>
        <ChevronDown size={14} aria-hidden="true" className="text-ink-subtle" />
      </button>

      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        className="bg-surface border-border text-ink fixed inset-auto top-14 right-4 m-0 w-60 rounded-lg border p-1.5 shadow-lg"
      >
        <Link href="/profile" onClick={close} className={ITEM_CLASSES}>
          <User size={15} aria-hidden="true" className="shrink-0" />
          {t('nav.profile')}
        </Link>

        {systemItems.length > 0 ? (
          <div className="border-border mt-1.5 border-t pt-1.5">
            <p className="text-ink-subtle px-3 pb-1 text-[11px] font-medium">{t('nav.system')}</p>
            {systemItems.map((item) => {
              const Icon = ICONS[item.icon] ?? Settings;
              return (
                <Link key={item.href} href={item.href} onClick={close} className={ITEM_CLASSES}>
                  <Icon size={15} aria-hidden="true" className="shrink-0" />
                  {t(`nav.${item.labelKey}`)}
                </Link>
              );
            })}
          </div>
        ) : null}

        <form action={signOutAction} className="border-border mt-1.5 border-t pt-1.5">
          <button type="submit" className={ITEM_CLASSES}>
            <LogOut size={15} aria-hidden="true" className="shrink-0" />
            {t('common.signOut')}
          </button>
        </form>
      </div>
    </>
  );
}
