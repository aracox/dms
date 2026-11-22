import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { amountOwed } from '@/lib/billing/calc';
import { formatAmount, formatTHB } from '@/lib/billing/money';
import { lastMeterNumber } from '@/lib/meters/tenancy';
import { can } from '@/lib/permissions';
import { getHeldReservation } from '@/lib/reservations/queries';
import type { RoomDetail } from '@/lib/rooms/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import {
  addMonths,
  bangkokToday,
  billingMonthOf,
  currentBillingMonth,
  formatBillingMonth,
  formatDate,
} from '@/lib/utils/date';

import { ContractRentField } from './ContractRentField';
import { FinalMeterForm } from './FinalMeterForm';
import { MoveOutForm } from './MoveOutForm';
import { MoveOutNoticeForm } from './MoveOutNoticeForm';
import { ReservationCard } from './ReservationCard';
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
  const reservation = await getHeldReservation(room.id);

  // A tenant the notice sweep moved out (or one from before move-outs took
  // final numbers) recently, with no final meter numbers yet.
  const missingFinalMeters = detail.contractHistory
    .filter(
      (candidate) =>
        candidate.status === 'terminated' &&
        candidate.terminated_at !== null &&
        candidate.meter_end_electricity === null &&
        candidate.meter_end_water === null &&
        billingMonthOf(candidate.terminated_at) >= addMonths(currentBillingMonth(), -1),
    )
    .sort((a, b) => (a.terminated_at! < b.terminated_at! ? 1 : -1))[0];
  const lastMetersOn = (through: string) => ({
    electricity: lastMeterNumber({
      type: 'electricity',
      readings: detail.meterReadings,
      contracts: detail.contractHistory,
      through,
    }),
    water: lastMeterNumber({
      type: 'water',
      readings: detail.meterReadings,
      contracts: detail.contractHistory,
      through,
    }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('room.title', { roomNumber: room.room_number })}
          description={`${t('floorPlan.floor', { floor: room.floor })} · ${t(`roomType.${room.room_type}`)}${
            room.size_sqm ? ` · ${room.size_sqm} ${t('room.sqm')}` : ''
          }`}
        />
        <CardBody>
          <FieldGrid>
            {contract && canEditContract ? (
              <ContractRentField
                contractId={contract.id}
                roomId={room.id}
                monthlyRent={contract.monthly_rent}
                locale={locale}
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
          </FieldGrid>

          {canEditRoom &&
          (room.status === 'vacant' ||
            room.status === 'reserved' ||
            room.status === 'maintenance') ? (
            <div className="border-border mt-3 border-t pt-3">
              <RoomStatusButtons roomId={room.id} status={room.status} />
            </div>
          ) : null}

          {missingFinalMeters && canEditContract ? (
            <div className="border-border mt-3 border-t pt-3">
              <FinalMeterForm
                contractId={missingFinalMeters.id}
                movedOutOn={missingFinalMeters.terminated_at!}
                lastMeters={lastMetersOn(missingFinalMeters.terminated_at!)}
                locale={locale}
              />
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
            <div className="border-border mt-3 flex flex-wrap items-start gap-2 border-t pt-3">
              <MoveOutNoticeForm
                contractId={contract.id}
                roomId={room.id}
                today={bangkokToday()}
                noticeGivenAt={contract.notice_given_at}
                plannedMoveOutDate={contract.planned_move_out_date}
                noticeNote={contract.notice_note}
                locale={locale}
              />
              <MoveOutForm
                contractId={contract.id}
                roomId={room.id}
                today={bangkokToday()}
                owed={amountOwed(
                  detail.invoices.filter((invoice) => invoice.contract_id === contract.id),
                )}
                paidBills={detail.invoices
                  .filter(
                    (invoice) =>
                      invoice.contract_id === contract.id &&
                      invoice.billing_month >= currentBillingMonth() &&
                      (invoice.status === 'paid' || invoice.status === 'partially_paid'),
                  )
                  .map((invoice) => invoice.invoice_number)}
                lastMeters={lastMetersOn(bangkokToday())}
                locale={locale}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <ReservationCard
        roomId={room.id}
        reservation={reservation}
        canEdit={canEditRoom}
        locale={locale}
      />

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
          canEditContract={canEditContract}
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
                    ? t('meters.usageUnits', {
                        units: formatAmount(latestElectricity.usage, locale),
                      })
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
                    ? t('meters.usageUnits', { units: formatAmount(latestWater.usage, locale) })
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
