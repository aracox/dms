import { useTranslations } from 'next-intl';

import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { SEGMENT_VIEWS, type SegmentView } from '@/lib/reporting/segments';

/**
 * Picks which slice of the property a page reports on.
 *
 * Plain links over a `?segment=` parameter rather than client state: the pages
 * that use this are server-rendered, so there is nothing for the client to
 * recompute, the choice survives a reload or a shared link, and the switcher
 * ships no JavaScript.
 *
 * `pathname` is the page the links point back at, so the same control serves
 * the dashboard and the rooms list without either one owning it. `query`
 * carries the page's other filters through, so switching segment keeps them.
 */
export function SegmentSwitcher({
  current,
  pathname,
  query = {},
}: {
  current: SegmentView;
  pathname: string;
  query?: Record<string, string>;
}) {
  const t = useTranslations();

  return (
    <div
      role="group"
      aria-label={t('segment.filterLabel')}
      className="border-border bg-surface-sunken inline-flex gap-1 rounded-md border p-1"
    >
      {SEGMENT_VIEWS.map((view) => {
        const active = view === current;

        return (
          <Link
            key={view}
            href={{ pathname, query: view === 'all' ? query : { ...query, segment: view } }}
            aria-current={active ? 'true' : undefined}
            className={buttonClasses(active ? 'primary' : 'ghost', 'sm')}
          >
            {view === 'all' ? t('segment.wholeProperty') : t(`segment.${view}`)}
          </Link>
        );
      })}
    </div>
  );
}
