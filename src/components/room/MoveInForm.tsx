'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RequiredMark } from '@/components/ui/RequiredMark';
import { moveInAction, type MoveInState } from '@/lib/rooms/actions';

const INITIAL_STATE: MoveInState = { error: null };

const LABEL_CLASS = 'text-ink block text-body-sm font-medium';

function TextField({
  name,
  label,
  type = 'text',
  defaultValue,
  required,
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  step?: string;
  min?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className={LABEL_CLASS}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        step={step}
        min={min}
        className="mt-1"
      />
    </div>
  );
}

export function MoveInForm({
  roomId,
  defaultRent,
  defaultDeposit,
  defaultDueDay,
  startDate,
  endDate,
}: {
  roomId: string;
  defaultRent: number;
  defaultDeposit: number;
  defaultDueDay: number;
  startDate: string;
  endDate: string;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(moveInAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="room_id" value={roomId} />

      <Card>
        <CardHeader title={t('tenant.title')} description={t('tenant.singleTenantNotice')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField name="full_name" label={t('tenant.fullName')} required />
            <TextField name="phone" label={t('room.phone')} required />
            <TextField name="email" label={t('room.email')} type="email" />
            <TextField name="id_card_or_passport" label={t('tenant.idCard')} />
            <TextField name="nationality" label={t('tenant.nationality')} />
            <TextField name="emergency_contact" label={t('tenant.emergencyContact')} />
            <TextField name="emergency_phone" label={t('tenant.emergencyPhone')} />
            <TextField name="line_id" label={t('tenant.lineId')} />
          </div>

          <div className="mt-4">
            <label htmlFor="documents" className={LABEL_CLASS}>
              {t('tenant.documents')}
            </label>
            <input
              id="documents"
              name="documents"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="text-ink-muted mt-1 block w-full text-sm"
            />
            <p className="text-ink-subtle text-caption mt-1">{t('tenant.documentsHint')}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('contract.title')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              name="start_date"
              label={t('contract.startDate')}
              type="date"
              defaultValue={startDate}
              required
            />
            <TextField
              name="end_date"
              label={t('contract.endDate')}
              type="date"
              defaultValue={endDate}
              required
            />
            <TextField
              name="occupant_count"
              label={t('room.occupants')}
              type="number"
              min={1}
              defaultValue={1}
              required
            />
            <TextField
              name="monthly_rent"
              label={t('room.monthlyRent')}
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaultRent}
              required
            />
            <TextField
              name="deposit"
              label={t('room.deposit')}
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaultDeposit}
              required
            />
            <TextField
              name="payment_due_day"
              label={t('room.paymentDueDay')}
              type="number"
              min={1}
              defaultValue={defaultDueDay}
              required
            />
          </div>

          <label className="text-ink text-body-sm mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              name="activate_cards"
              defaultChecked
              className="accent-brand-blue size-5 rounded-sm"
            />
            {t('contract.activateCards')}
          </label>
        </CardBody>
      </Card>

      {state.error ? (
        <p
          role="alert"
          className="border-brand-red bg-brand-red-soft text-brand-red-deep text-caption rounded-md border px-3 py-2"
        >
          {t(state.error)}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="md" disabled={isPending}>
        {isPending ? t('common.loading') : t('contract.moveIn')}
      </Button>
    </form>
  );
}
