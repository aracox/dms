import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { can } from '@/lib/permissions';
import { getExpiringContracts, getMeterUsage, getReportRooms } from '@/lib/reporting/queries';
import { filterByView, parseSegmentView } from '@/lib/reporting/segments';
import { getCurrentProfile } from '@/lib/supabase/server';
import { currentBillingMonth, formatDate } from '@/lib/utils/date';
import { toCsv } from '@/lib/utils/csv';

const REPORT_TYPES = ['rooms', 'meters', 'contracts'] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function isReportType(value: string | null): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

/** Downloads one of the reports page's tables as CSV, honoring the same segment filter. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const profile = await getCurrentProfile();
  if (!can(profile?.role, 'reports:read')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { locale } = await params;
  const typedLocale = (locale === 'en' ? 'en' : 'th') as Locale;
  const t = await getTranslations({ locale });

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  if (!isReportType(type)) {
    return new Response('Unknown report type', { status: 400 });
  }
  const view = parseSegmentView(url.searchParams.get('segment') ?? undefined);

  let csv: string;

  if (type === 'rooms') {
    const rooms = filterByView(view, await getReportRooms());
    csv = toCsv(
      [
        t('room.roomNumber'),
        t('room.floor'),
        t('room.type'),
        t('common.status'),
        t('room.mainTenant'),
        t('room.occupants'),
        t('room.monthlyRent'),
      ],
      rooms.map((room) => [
        room.room_number,
        room.floor,
        t(`roomType.${room.room_type}`),
        t(`roomStatus.${room.room_status}`),
        room.tenant_name ?? '',
        room.occupant_count ?? '',
        room.monthly_rent,
      ]),
    );
  } else if (type === 'meters') {
    const allMeterUsage = await getMeterUsage(currentBillingMonth());
    const allRooms = await getReportRooms();
    const segmentByRoomId = new Map(allRooms.map((room) => [room.room_id, room.property_segment]));
    const meterUsage =
      view === 'all'
        ? allMeterUsage
        : allMeterUsage.filter((row) => segmentByRoomId.get(row.room_id) === view);

    csv = toCsv(
      [
        t('room.roomNumber'),
        t('segment.column'),
        t('common.status'),
        t('meters.previousReading'),
        t('meters.currentReading'),
        t('meters.usage'),
        t('common.rate'),
        t('common.amount'),
      ],
      meterUsage.map((row) => [
        row.room_number,
        t(`segment.${segmentByRoomId.get(row.room_id) ?? 'dorm'}`),
        t(`meterType.${row.meter_type}`),
        row.previous_reading,
        row.current_reading,
        row.usage,
        row.rate,
        row.amount,
      ]),
    );
  } else {
    const expiring = filterByView(view, await getExpiringContracts(3650));
    csv = toCsv(
      [
        t('room.roomNumber'),
        t('segment.column'),
        t('tenant.title'),
        t('contract.startDate'),
        t('contract.endDate'),
        t('common.days'),
        t('room.monthlyRent'),
      ],
      expiring.map((contract) => [
        contract.room_number,
        t(`segment.${contract.property_segment}`),
        contract.tenant_name,
        formatDate(contract.start_date, typedLocale),
        formatDate(contract.end_date, typedLocale),
        contract.days_remaining,
        contract.monthly_rent,
      ]),
    );
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}-report.csv"`,
    },
  });
}
