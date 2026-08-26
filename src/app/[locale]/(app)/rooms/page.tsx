import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { RoomsTable } from '@/components/room/RoomsTable';
import type { Locale } from '@/i18n/routing';
import { getRoomBoard } from '@/lib/rooms/queries';

export default async function RoomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const rooms = await getRoomBoard({ includeTest: false });

  return (
    <>
      <PageHeader
        title={t('rooms.title')}
        description={t('rooms.subtitle', { count: rooms.length })}
      />
      <RoomsTable rooms={rooms} locale={locale as Locale} />
    </>
  );
}
