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
 *
 * Keeps the query string (a room's `?tab=`, a `?segment=` filter) so the user
 * stays exactly where they were. Read from window.location at click time rather
 * than useSearchParams: it also picks up params written by history.replaceState,
 * and avoids needing a Suspense boundary on every page that renders the header.
 */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
      <Languages size={15} className="text-ink-subtle hidden sm:block" aria-hidden="true" />
      {routing.locales.map((candidate) => {
        const isActive = candidate === locale;

        return (
          <button
            key={candidate}
            type="button"
            lang={candidate}
            aria-label={LOCALE_LABELS[candidate]}
            aria-current={isActive ? 'true' : undefined}
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                router.replace(`${pathname}${window.location.search}`, { locale: candidate });
              });
            }}
            className={cn(
              'text-caption inline-flex min-h-9 items-center rounded-sm px-1.5 py-1.5 font-medium sm:px-2.5',
              isActive
                ? 'bg-brand-blue-soft text-brand-blue-deep'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
              isPending && 'opacity-60',
            )}
          >
            <span className="sm:hidden">{candidate === 'en' ? 'EN' : 'ไทย'}</span>
            <span className="hidden sm:inline">{LOCALE_LABELS[candidate]}</span>
          </button>
        );
      })}
    </div>
  );
}
