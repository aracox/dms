import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { RoomMetersTab } from '@/components/room/RoomMetersTab';
import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getRoomDetail } from '@/lib/rooms/queries';

export default async function RoomMetersPage({
  params,
}: {
  params: Promise<{ locale: string; roomId: string }>;
}) {
  const { locale, roomId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const detail = await getRoomDetail(roomId);

  if (!detail || detail.room.is_test) notFound();

  const { room, board } = detail;

  return (
    <>
      <Link
        href="/meters"
        className="text-ink-muted hover:text-ink text-caption mb-3 inline-flex items-center gap-1"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {t('meters.title')}
      </Link>

      <PageHeader
        title={`${t('meters.title')} · ${t('room.title', { roomNumber: room.room_number })}`}
        description={`${t('floorPlan.floor', { floor: room.floor })} · ${t(`roomType.${room.room_type}`)}`}
        action={
          <RoomStatusBadge
            roomStatus={room.status}
            financialStatus={board?.financial_status ?? 'none'}
          />
        }
      />

      <RoomMetersTab detail={detail} locale={locale as Locale} />
    </>
  );
}
