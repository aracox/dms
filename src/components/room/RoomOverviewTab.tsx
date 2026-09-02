import { getTranslations } from 'next-intl/server';

import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { can } from '@/lib/permissions';
import type { RoomDetail } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday, formatBillingMonth, formatDate } from '@/lib/utils/date';

import { ContractRentField } from './ContractRentField';
import { MoveOutForm } from './MoveOutForm';
import { RoomStatusButtons } from './RoomStatusButtons';
import { RoomVehiclesCard } from './RoomVehiclesCard';
import { TenantContactCard } from './TenantContactCard';

/** Everything the spec asks a room click to reveal, on one panel. */
export async function RoomOverviewTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = await getTranslations();
  const { room, board, contract, tenant } = detail;
  const profile = await getCurrentProfile();
  const canEditTenant = can(profile?.role, 'tenants:write');
  const canEditRoom = can(profile?.role, 'rooms:write');
  const canEditContract = can(profile?.role, 'contracts:write');
  const canMoveIn = !contract && can(profile?.role, 'contracts:write');

  const latestElectricity = detail.meterReadings.find(
    (reading) => reading.meter_type === 'electricity',
  );
  const latestWater = detail.meterReadings.find((reading) => reading.meter_type === 'water');
  const currentInvoice = detail.invoices[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('room.title', { roomNumber: room.room_number })}
          description={`${t('floorPlan.floor', { floor: room.floor })} · ${t(`roomType.${room.room_type}`)}${
            room.size_sqm ? ` · ${room.size_sqm} ${t('room.sqm')}` : ''
          }`}
          action={
            <RoomStatusBadge
              roomStatus={room.status}
              financialStatus={board?.financial_status ?? 'none'}
            />
          }
        />
        <CardBody>
          <FieldGrid>
            {contract && canEditContract ? (
              <ContractRentField
                contractId={contract.id}
                roomId={room.id}
                monthlyRent={contract.monthly_rent}
              />
            ) : (
              <Field
                label={t('room.monthlyRent')}
                value={formatTHB(board?.monthly_rent ?? contract?.monthly_rent ?? 0, locale)}
              />
            )}
            <Field
              label={t('room.deposit')}
              value={formatTHB(board?.deposit ?? contract?.deposit ?? 0, locale)}
            />
            <Field label={t('room.status')} value={t(`roomStatus.${room.status}`)} />
          </FieldGrid>

          {canEditRoom &&
          (room.status === 'vacant' ||
            room.status === 'reserved' ||
            room.status === 'maintenance') ? (
            <div className="border-border mt-3 border-t pt-3">
              <RoomStatusButtons roomId={room.id} status={room.status} />
            </div>
          ) : null}

          {canMoveIn ? (
            <div className="border-border mt-3 border-t pt-3">
              <Link href={`/rooms/${room.id}/move-in`} className={buttonClasses('primary', 'sm')}>
                {t('contract.moveIn')}
              </Link>
            </div>
          ) : null}

          {contract && contract.status === 'active' && canEditContract ? (
            <div className="border-border mt-3 border-t pt-3">
              <MoveOutForm contractId={contract.id} roomId={room.id} today={bangkokToday()} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <RoomVehiclesCard
        roomId={room.id}
        carPlate={room.car_plate}
        motorcyclePlate={room.motorcycle_plate}
        canEdit={canEditRoom}
      />

      {tenant && contract ? (
        <TenantContactCard
          roomId={room.id}
          tenant={tenant}
          contract={contract}
          locale={locale}
          canEdit={canEditTenant}
        />
      ) : (
        <Card>
          <CardHeader title={t('room.mainTenant')} description={t('tenant.singleTenantNotice')} />
          <CardBody>
            <p className="text-ink-subtle text-body-sm">{t('room.noTenant')}</p>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title={t('meters.title')} />
          <CardBody>
            <FieldGrid className="sm:grid-cols-2 lg:grid-cols-2">
              <Field
                label={t('room.electricity')}
                value={
                  latestElectricity
                    ? t('meters.usageUnits', { units: latestElectricity.usage })
                    : t('room.noMeterReading')
                }
                hint={
                  latestElectricity
                    ? `${formatBillingMonth(latestElectricity.billing_month, locale)} · ${formatTHB(latestElectricity.amount, locale)}`
                    : undefined
                }
              />
              <Field
                label={t('room.water')}
                value={
                  latestWater
                    ? t('meters.usageUnits', { units: latestWater.usage })
                    : t('room.noMeterReading')
                }
                hint={
                  latestWater
                    ? `${formatBillingMonth(latestWater.billing_month, locale)} · ${formatTHB(latestWater.amount, locale)}`
                    : undefined
                }
              />
            </FieldGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('room.currentBill')} />
          <CardBody>
            {currentInvoice ? (
              <FieldGrid className="sm:grid-cols-2 lg:grid-cols-2">
                <Field
                  label={t('billing.total')}
                  value={formatTHB(currentInvoice.total, locale)}
                  hint={formatBillingMonth(currentInvoice.billing_month, locale)}
                />
                <Field
                  label={t('billing.outstanding')}
                  value={formatTHB(board?.outstanding ?? 0, locale)}
                  hint={`${t('billing.dueDate')} ${formatDate(currentInvoice.due_date, locale)}`}
                />
                <Field
                  label={t('room.paymentStatus')}
                  value={
                    <Badge
                      tone={
                        currentInvoice.status === 'paid'
                          ? 'green'
                          : currentInvoice.status === 'overdue'
                            ? 'red'
                            : currentInvoice.status === 'partially_paid'
                              ? 'yellow'
                              : 'neutral'
                      }
                    >
                      {t(`invoiceStatus.${currentInvoice.status}`)}
                    </Badge>
                  }
                />
                <Field label={t('billing.invoiceNumber')} value={currentInvoice.invoice_number} />
              </FieldGrid>
            ) : (
              <p className="text-ink-subtle text-body-sm">{t('room.noInvoice')}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
