'use client';

import { ArrowRight, CreditCard, Phone, Users, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { formatBillingMonth, formatDate } from '@/lib/utils/date';
import type { RoomBoardRow } from '@/types/database';

/**
 * Quick information for the floor plan drawer.
 *
 * Renders entirely from the v_room_board row the page already loaded, so
 * clicking a room costs no extra request. Anything deeper lives on the full
 * room page.
 */
export function RoomQuickView({ room, locale }: { room: RoomBoardRow; locale: Locale }) {
  const t = useTranslations();
  const isOccupied = room.room_status === 'occupied';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RoomStatusBadge roomStatus={room.room_status} financialStatus={room.financial_status} />
        <Badge>{t(`roomType.${room.room_type}`)}</Badge>
        {room.is_test ? <Badge tone="yellow">{t('nav.testMode')}</Badge> : null}
      </div>

      <dl className="border-border grid grid-cols-2 gap-x-4 border-t pt-2">
        <Field label={t('room.monthlyRent')} value={formatTHB(room.monthly_rent, locale)} />
        <Field label={t('room.deposit')} value={formatTHB(room.deposit, locale)} />
      </dl>

      {isOccupied && room.tenant_name ? (
        <dl className="border-border grid grid-cols-1 gap-x-4 border-t pt-2">
          <Field
            label={t('room.mainTenant')}
            value={room.tenant_name}
            hint={t('room.mainTenantHint')}
          />
          <Field
            label={
              <span className="inline-flex items-center gap-1">
                <Phone size={11} aria-hidden="true" />
                {t('room.phone')}
              </span>
            }
            value={
              room.tenant_phone ? (
                <a href={`tel:${room.tenant_phone}`} className="text-brand-blue-deep underline">
                  {room.tenant_phone}
                </a>
              ) : (
                t('common.notAvailable')
              )
            }
          />
          <Field
            label={
              <span className="inline-flex items-center gap-1">
                <Users size={11} aria-hidden="true" />
                {t('room.occupants')}
              </span>
            }
            value={t('room.occupantsValue', { count: room.occupant_count ?? 1 })}
            hint={
              (room.occupant_count ?? 1) > 1
                ? t('room.additionalOccupants', { count: (room.occupant_count ?? 1) - 1 })
                : undefined
            }
          />
          <Field
            label={t('room.contractPeriod')}
            value={`${formatDate(room.start_date, locale)} — ${formatDate(room.end_date, locale)}`}
          />
        </dl>
      ) : (
        <p className="border-border text-ink-subtle text-body-sm rounded-md border border-dashed px-3 py-4">
          {room.room_status === 'maintenance' ? t('maintenance.title') : t('room.emptyRoomHint')}
        </p>
      )}

      {room.invoice_id ? (
        <div className="border-border border-t pt-2">
          <dl className="grid grid-cols-2 gap-x-4">
            <Field
              label={t('room.currentBill')}
              value={formatTHB(room.invoice_total, locale)}
              hint={formatBillingMonth(room.billing_month, locale)}
            />
            <Field
              label={t('billing.outstanding')}
              value={formatTHB(room.outstanding, locale)}
              hint={`${t('billing.dueDate')} ${formatDate(room.due_date, locale)}`}
            />
          </dl>
        </div>
      ) : (
        <p className="border-border text-ink-subtle text-body-sm border-t pt-3">
          {t('room.noInvoice')}
        </p>
      )}

      <div className="border-border text-caption flex flex-wrap gap-2 border-t pt-3">
        <Badge
          tone={room.lost_card_count > 0 ? 'red' : 'neutral'}
          icon={<CreditCard size={11} aria-hidden="true" />}
        >
          {t('cards.title')} {room.active_card_count}/{room.total_card_count}
        </Badge>
        {room.open_maintenance_count > 0 ? (
          <Badge tone="yellow" icon={<Wrench size={11} aria-hidden="true" />}>
            {t('dashboard.openTickets')} {room.open_maintenance_count}
          </Badge>
        ) : null}
      </div>

      <Link href={`/rooms/${room.room_id}`} className={buttonClasses('primary', 'md')}>
        {t('room.openFullPage')}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
