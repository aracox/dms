import { useTranslations } from 'next-intl';

import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { RoomDetail } from '@/lib/rooms/queries';
import { formatBillingMonth, formatDate } from '@/lib/utils/date';

/** Everything the spec asks a room click to reveal, on one panel. */
export function RoomOverviewTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = useTranslations();
  const { room, board, contract, tenant } = detail;

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
            <Field label={t('room.monthlyRent')} value={formatTHB(room.monthly_rent, locale)} />
            <Field label={t('room.deposit')} value={formatTHB(room.deposit, locale)} />
            <Field label={t('room.status')} value={t(`roomStatus.${room.status}`)} />
          </FieldGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('room.mainTenant')} description={t('tenant.singleTenantNotice')} />
        <CardBody>
          {tenant && contract ? (
            <FieldGrid>
              <Field label={t('tenant.fullName')} value={tenant.full_name} />
              <Field
                label={t('room.phone')}
                value={
                  <a href={`tel:${tenant.phone}`} className="text-brand-blue-deep underline">
                    {tenant.phone}
                  </a>
                }
              />
              <Field
                label={t('room.occupants')}
                value={t('room.occupantsValue', { count: contract.occupant_count })}
                hint={
                  contract.occupant_count > 1
                    ? t('room.additionalOccupants', { count: contract.occupant_count - 1 })
                    : t('room.occupantsHint')
                }
              />
              <Field
                label={t('room.contractPeriod')}
                value={`${formatDate(contract.start_date, locale)} — ${formatDate(contract.end_date, locale)}`}
              />
              <Field label={t('room.paymentDueDay')} value={contract.payment_due_day} />
              <Field
                label={t('tenant.emergencyContact')}
                value={tenant.emergency_contact ?? t('common.notAvailable')}
                hint={tenant.emergency_phone ?? undefined}
              />
            </FieldGrid>
          ) : (
            <p className="text-ink-subtle text-sm">{t('room.noTenant')}</p>
          )}
        </CardBody>
      </Card>

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
              <p className="text-ink-subtle text-sm">{t('room.noInvoice')}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
