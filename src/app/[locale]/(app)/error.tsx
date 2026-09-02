'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Error boundary for the authenticated area.
 *
 * PermissionError from `assertCan` surfaces here. Its message names the required
 * role, which is safe to show an authenticated member of staff.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  const isPermissionError = error.name === 'PermissionError';

  return (
    <div className="border-border bg-surface mx-auto max-w-md rounded-xl border px-5 py-8 text-center shadow-md">
      <span className="bg-brand-red-soft text-brand-red-deep mx-auto flex size-10 items-center justify-center rounded-full">
        <TriangleAlert size={20} aria-hidden="true" />
      </span>

      <h1 className="text-ink font-display text-h4 mt-3 font-semibold">
        {isPermissionError ? t('auth.accessDenied') : t('errors.generic')}
      </h1>

      {isPermissionError ? (
        <p className="text-ink-muted text-body-sm mt-1">{t('errors.permissionDenied')}</p>
      ) : null}

      {error.digest ? (
        <p className="text-ink-subtle text-caption mt-2 font-mono">{error.digest}</p>
      ) : null}

      {!isPermissionError ? (
        <button
          type="button"
          onClick={reset}
          className="bg-brand-blue hover:bg-brand-blue-deep mt-4 rounded-md px-3 py-2 text-sm font-medium text-white"
        >
          {t('common.back')}
        </button>
      ) : null}
    </div>
  );
}
