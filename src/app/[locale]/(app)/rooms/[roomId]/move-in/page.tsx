import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { MoveInForm } from '@/components/room/MoveInForm';
import { Link, redirect } from '@/i18n/navigation';
import { assertCan } from '@/lib/permissions';
import { getRoomDetail } from '@/lib/rooms/queries';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  const { data: moveInSettings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['default_payment_due_day', 'default_monthly_rent']);

  const settingValue = (key: string) => moveInSettings?.find((row) => row.key === key)?.value;
  const dueDaySetting = settingValue('default_payment_due_day');
  const rentSetting = settingValue('default_monthly_rent');

  const defaultDueDay = typeof dueDaySetting === 'number' ? dueDaySetting : 5;
  const defaultRent = room.monthly_rent || (typeof rentSetting === 'number' ? rentSetting : 0);

  const startDate = bangkokToday();
  const [year, month, day] = startDate.split('-').map(Number);
  const endDate = `${(year ?? 0) + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <>
      <Link
        href={`/rooms/${roomId}`}
        className="text-ink-muted hover:text-ink mb-3 inline-flex items-center gap-1 text-xs"
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
        defaultDeposit={room.deposit}
        defaultDueDay={defaultDueDay}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
