import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { FloorPlanView } from '@/components/floor-plan/FloorPlanView';
import type { Locale } from '@/i18n/routing';
import { parseSegmentView } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';

/**
 * All 24 real rooms are fetched once and handed to the client component, so
 * switching floors and opening a room need no further requests.
 *
 * `includeTest` is left at its default of false: T01 is on floor 0 and has no
 * layout entry, but filtering here too keeps the intent explicit.
 *
 * The segment filter is deliberately NOT applied to this list. FloorPlanSvg
 * draws a layout entry with no matching row as a dashed outline, meaning "the
 * seed and the layout have drifted" -- so dropping the out-of-segment rooms
 * here would report a data fault instead of a filter. The view is passed
 * through and those units are dimmed in place.
 */
export default async function FloorPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const view = parseSegmentView((await searchParams).segment);
  const rooms = await getRoomBoard({ includeTest: false });

  return (
    <div className="flex flex-col lg:-my-5 lg:h-[calc(100dvh-53px)] lg:py-5">
      <PageHeader
        title={t('floorPlan.title')}
        description={t('floorPlan.subtitle')}
        action={<SegmentSwitcher current={view} pathname="/floor-plan" />}
      />
      <FloorPlanView rooms={rooms} view={view} locale={locale as Locale} />
    </div>
  );
}
