import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { RoomDetail } from '@/components/room/RoomDetail';
import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getRoomDetail } from '@/lib/rooms/queries';
import { bangkokToday } from '@/lib/utils/date';

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ locale: string; roomId: string }>;
}) {
  const { locale, roomId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const detail = await getRoomDetail(roomId);

  if (!detail) notFound();

  const { room, board } = detail;

  return (
    <>
      <Link
        href="/floor-plan"
        className="text-ink-muted hover:text-ink text-caption mb-3 inline-flex items-center gap-1"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {t('floorPlan.title')}
      </Link>

      <PageHeader
        title={t('room.title', { roomNumber: room.room_number })}
        description={`${t('floorPlan.floor', { floor: room.floor })} · ${t(`roomType.${room.room_type}`)}`}
        action={
          <div className="flex items-center gap-2">
            {room.is_test ? <Badge tone="yellow">{t('nav.testMode')}</Badge> : null}
            <RoomStatusBadge
              roomStatus={room.status}
              financialStatus={board?.financial_status ?? 'none'}
            />
          </div>
        }
      />

      <RoomDetail detail={detail} locale={locale as Locale} today={bangkokToday()} />
    </>
  );
}
