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
    <div className="border-border bg-surface mx-auto max-w-md rounded-lg border px-5 py-8 text-center">
      <span className="bg-brand-red-soft text-brand-red-deep mx-auto flex size-10 items-center justify-center rounded-full">
        <TriangleAlert size={20} aria-hidden="true" />
      </span>

      <h1 className="text-ink mt-3 text-base font-semibold">
        {isPermissionError ? t('auth.accessDenied') : t('errors.generic')}
      </h1>

      {isPermissionError ? (
        <p className="text-ink-muted mt-1 text-sm">{t('errors.permissionDenied')}</p>
      ) : null}

      {error.digest ? (
        <p className="text-ink-subtle mt-2 font-mono text-[11px]">{error.digest}</p>
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
