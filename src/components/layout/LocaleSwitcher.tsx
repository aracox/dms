'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_LABELS, routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';

/**
 * Switches language only. Business data is language-neutral in the database, so
 * nothing stored changes -- the same rows are simply relabelled.
 */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
      <Languages size={15} className="text-ink-subtle" aria-hidden="true" />
      {routing.locales.map((candidate) => {
        const isActive = candidate === locale;

        return (
          <button
            key={candidate}
            type="button"
            lang={candidate}
            aria-current={isActive ? 'true' : undefined}
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                router.replace(pathname, { locale: candidate });
              });
            }}
            className={cn(
              'text-caption rounded px-1.5 py-1 font-medium',
              isActive
                ? 'bg-brand-blue-soft text-brand-blue-deep'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
              isPending && 'opacity-60',
            )}
          >
            {LOCALE_LABELS[candidate]}
          </button>
        );
      })}
    </div>
  );
}
