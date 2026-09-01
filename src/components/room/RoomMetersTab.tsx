import type { Locale } from '@/i18n/routing';
import { can } from '@/lib/permissions';
import type { RoomDetail } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import type { MeterType } from '@/types/database';

import { MetersSection } from './MetersSection';

export async function RoomMetersTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const profile = await getCurrentProfile();
  const canRecord = can(profile?.role, 'meters:record');
  const canCorrect = can(profile?.role, 'meters:correct');
  const canDelete = can(profile?.role, 'meters:delete');

  const rateFor = (meterType: MeterType) => {
    const value = detail.settings[`${meterType}_rate`];
    return typeof value === 'number' ? value : 0;
  };

  return (
    <MetersSection
      roomId={detail.room.id}
      readings={detail.meterReadings}
      rates={{ electricity: rateFor('electricity'), water: rateFor('water') }}
      canRecord={canRecord}
      canCorrect={canCorrect}
      canDelete={canDelete}
      locale={locale}
    />
  );
}
