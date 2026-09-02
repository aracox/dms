'use client';

import {
  Banknote,
  ChartColumn,
  CreditCard,
  DoorClosed,
  FlaskConical,
  Gauge,
  HandCoins,
  LayoutDashboard,
  Map,
  ReceiptText,
  Settings,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { can, type Permission } from '@/lib/permissions';
import type { AppRole } from '@/types/database';

import { NAV_SECTIONS } from './nav-items';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Map,
  DoorClosed,
  ReceiptText,
  Banknote,
  Gauge,
  CreditCard,
  Wrench,
  HandCoins,
  ChartColumn,
  Settings,
  FlaskConical,
  User,
};

export function Sidebar({ role }: { role: AppRole | null }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('dashboard')} className="space-y-5">
      {NAV_SECTIONS.map((section, sectionIndex) => {
        const visible = section.items.filter(
          (item) => !item.permission || can(role, item.permission as Permission),
        );
        if (visible.length === 0) return null;

        return (
          <div key={section.labelKey ?? `section-${sectionIndex}`}>
            {section.labelKey ? (
              <h2 className="text-ink-subtle px-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                {t(section.labelKey)}
              </h2>
            ) : null}

            <ul className="space-y-0.5">
              {visible.map((item) => {
                const Icon = ICONS[item.icon] ?? DoorClosed;
                // Match the section, so /rooms/<id> keeps Rooms highlighted.
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
                        isActive
                          ? 'bg-brand-blue-soft text-brand-blue-deep font-semibold'
                          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                      )}
                    >
                      <Icon size={16} aria-hidden="true" className="shrink-0" />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
