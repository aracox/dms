'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from './Button';

/**
 * Client-side paging over an already-loaded list. Clamps rather than resets
 * when the list shrinks, so removing the last item on the last page lands on
 * the new last page instead of jumping back to the first.
 */
export function usePager<T>(items: readonly T[], perPage: number) {
  const [requested, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(requested, pageCount - 1);

  return {
    page,
    pageCount,
    setPage,
    pageItems: items.slice(page * perPage, (page + 1) * perPage),
  };
}

/** Previous / "page x of y" / next, shown only when there is more than one page. */
export function Pager({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
}) {
  const t = useTranslations();
  if (pageCount <= 1) return null;

  return (
    <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3">
      <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
        {t('common.previousPage')}
      </Button>
      <p className="text-ink-muted text-caption" aria-live="polite">
        {t('common.pageOf', { page: page + 1, total: pageCount })}
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setPage(page + 1)}
        disabled={page === pageCount - 1}
      >
        {t('common.nextPage')}
      </Button>
    </div>
  );
}
