import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { MoveInForm } from '@/components/room/MoveInForm';
import { Link, redirect } from '@/i18n/navigation';
import { assertCan } from '@/lib/permissions';
import { propertySegment } from '@/lib/reporting/segments';
import { getRoomDetail } from '@/lib/rooms/queries';
import { getSegmentSettings } from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';

export default async function MoveInPage({
  params,
}: {
  params: Promise<{ locale: string; roomId: string }>;
}) {
  const { locale, roomId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const profile = await getCurrentProfile();
  // Throws PermissionError, which the error boundary renders.
  assertCan(profile?.role, 'contracts:write');

  const detail = await getRoomDetail(roomId);
  if (!detail) notFound();
  const { room, contract } = detail;

  if (contract) {
    redirect({ href: `/rooms/${roomId}`, locale });
    return null;
  }

  // A house prefills the บ้านพัก rent and deposit, not the dorm's -- these
  // defaults are per segment since migration 0025.
  const defaults = await getSegmentSettings(propertySegment(room.room_type));

  const defaultDueDay = defaults.default_payment_due_day || 5;
  const defaultRent = defaults.default_monthly_rent;
  const defaultDeposit = defaults.default_deposit;

  const startDate = bangkokToday();
  const [year, month, day] = startDate.split('-').map(Number);
  const endDate = `${(year ?? 0) + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <>
      <Link
        href={`/rooms/${roomId}`}
        className="text-ink-muted hover:text-ink text-caption mb-3 inline-flex items-center gap-1"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {t('room.title', { roomNumber: room.room_number })}
      </Link>

      <PageHeader
        title={t('contract.moveIn')}
        description={t('room.title', { roomNumber: room.room_number })}
      />

      <MoveInForm
        roomId={room.id}
        defaultRent={defaultRent}
        defaultDeposit={defaultDeposit}
        defaultDueDay={defaultDueDay}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
