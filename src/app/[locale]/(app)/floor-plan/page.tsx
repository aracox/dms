import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { FloorPlanView } from '@/components/floor-plan/FloorPlanView';
import type { Locale } from '@/i18n/routing';
import { getRoomBoard } from '@/lib/rooms/queries';

/**
 * All 24 real rooms are fetched once and handed to the client component, so
 * switching floors and opening a room need no further requests.
 *
 * `includeTest` is left at its default of false: T01 is on floor 0 and has no
 * layout entry, but filtering here too keeps the intent explicit.
 */
export default async function FloorPlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const rooms = await getRoomBoard({ includeTest: false });

  return (
    <div className="flex flex-col lg:-my-5 lg:h-[calc(100dvh-53px)] lg:py-5">
      <PageHeader title={t('floorPlan.title')} description={t('floorPlan.subtitle')} />
      <FloorPlanView rooms={rooms} locale={locale as Locale} />
    </div>
  );
}
