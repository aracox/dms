import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { RoomsTable } from '@/components/room/RoomsTable';
import type { Locale } from '@/i18n/routing';
import { filterRoomsByView, parseSegmentView } from '@/lib/reporting/segments';
import { getRoomBoard } from '@/lib/rooms/queries';

export default async function RoomsPage({
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
  // v_room_board carries room_type, not property_segment, so the หอพัก /
  // บ้านพัก split is derived the same way the SQL derives it.
  const rooms = filterRoomsByView(view, await getRoomBoard({ includeTest: false }));

  return (
    <>
      <PageHeader
        title={t('rooms.title')}
        description={
          view === 'all'
            ? t('rooms.subtitle', { count: rooms.length })
            : t('rooms.subtitleSegment', {
                segment: t(`segment.${view}`),
                units: t(`segment.units.${view}`, { count: rooms.length }),
              })
        }
        action={<SegmentSwitcher current={view} pathname="/rooms" />}
      />
      <RoomsTable rooms={rooms} locale={locale as Locale} />
    </>
  );
}
