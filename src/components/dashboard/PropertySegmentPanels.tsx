import { Banknote, DoorOpen, TrendingUp, TriangleAlert, Users, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Card, CardHeader } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import type {
  FinanceSummaryRow,
  PropertySegment,
  RoomSummaryRow,
  TenantSummaryRow,
} from '@/types/database';

function SegmentStat({
  label,
  value,
  accent,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-ink-muted text-caption flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className={cn('text-body-lg mt-0.5 font-semibold tabular-nums', accent ?? 'text-ink')}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The หอพัก / บ้านพัก breakdown: one panel per segment, carrying that segment's
 * own occupancy, people and money. The whole-property tiles above it stay --
 * the owner needs both the combined total and the split.
 */
export function PropertySegmentPanels({
  rooms,
  finance,
  tenants,
  locale,
}: {
  rooms: Record<PropertySegment, RoomSummaryRow>;
  finance: Record<PropertySegment, FinanceSummaryRow>;
  tenants: Record<PropertySegment, TenantSummaryRow>;
  locale: Locale;
}) {
  const t = useTranslations();
  const money = (amount: number) => formatTHB(amount, locale);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {PROPERTY_SEGMENTS.map((segment) => {
        const room = rooms[segment];
        const segmentFinance = finance[segment];
        const people = tenants[segment];

        return (
          <Card key={segment}>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <span
                    className={cn('size-2.5 rounded-sm', SEGMENT_STYLES[segment].fill)}
                    aria-hidden="true"
                  />
                  {t(`segment.${segment}`)}
                </span>
              }
              description={t(`segment.units.${segment}`, { count: room.total_rooms })}
              action={
                <div className="text-right">
                  <p className="text-ink-subtle text-caption flex items-center justify-end gap-1.5">
                    <TrendingUp size={13} aria-hidden="true" />
                    {t('dashboard.occupancyRate')}
                  </p>
                  <p className="text-brand-blue-deep text-h3 mt-0.5 font-semibold tabular-nums">
                    {room.occupancy_rate}%
                  </p>
                </div>
              }
            />
            <div className="p-4 sm:px-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <SegmentStat
                  label={t('dashboard.occupied')}
                  value={`${room.occupied} / ${room.total_rooms}`}
                  accent="text-brand-green-deep"
                  icon={<Users size={13} aria-hidden="true" />}
                />
                <SegmentStat
                  label={t('dashboard.vacant')}
                  value={room.vacant}
                  icon={<DoorOpen size={13} aria-hidden="true" />}
                />
                <SegmentStat label={t('dashboard.reserved')} value={room.reserved} />
                <SegmentStat
                  label={t('dashboard.maintenance')}
                  value={room.maintenance}
                  accent={room.maintenance > 0 ? 'text-brand-yellow-deep' : undefined}
                  icon={<Wrench size={13} aria-hidden="true" />}
                />
                <SegmentStat
                  label={t('dashboard.registeredTenants')}
                  value={people.registered_tenants}
                />
                <SegmentStat label={t('dashboard.totalOccupants')} value={people.total_occupants} />
              </dl>
              <dl className="border-border mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4">
                <SegmentStat
                  label={t('dashboard.expectedRevenue')}
                  value={money(segmentFinance.expected_rent)}
                  accent="text-brand-blue-deep"
                />
                <SegmentStat
                  label={t('dashboard.collectedThisMonth')}
                  value={money(segmentFinance.collected_this_month)}
                  accent="text-brand-green-deep"
                  icon={<Banknote size={13} aria-hidden="true" />}
                />
                <SegmentStat
                  label={t('dashboard.outstanding')}
                  value={money(segmentFinance.outstanding)}
                  accent={segmentFinance.outstanding > 0 ? 'text-brand-yellow-deep' : undefined}
                />
                <SegmentStat
                  label={t('dashboard.overdue')}
                  value={money(segmentFinance.overdue)}
                  accent={segmentFinance.overdue > 0 ? 'text-brand-red-deep' : undefined}
                  icon={<TriangleAlert size={13} aria-hidden="true" />}
                />
              </dl>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
