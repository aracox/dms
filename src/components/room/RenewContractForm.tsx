'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { renewContractAction, type RenewContractState } from '@/lib/contracts/actions';

const INITIAL_STATE: RenewContractState = { error: null };

/**
 * Collapsed by default: a "+ Renew contract" button reveals a fresh term's
 * fields, defaulted to a 1-year extension at the current rent/deposit --
 * change any of them before saving if the new term differs.
 */
export function RenewContractForm({
  contractId,
  roomId,
  defaultStartDate,
  defaultEndDate,
  defaultMonthlyRent,
  defaultDeposit,
  defaultPaymentDueDay,
  defaultOccupantCount,
}: {
  contractId: string;
  roomId: string;
  defaultStartDate: string;
  defaultEndDate: string;
  defaultMonthlyRent: number;
  defaultDeposit: number;
  defaultPaymentDueDay: number;
  defaultOccupantCount: number;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(renewContractAction, INITIAL_STATE);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + {t('contract.renew')}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('contract.renew')}
        action={
          <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        }
      />
      <CardBody>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="contract_id" value={contractId} />
          <input type="hidden" name="room_id" value={roomId} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={t('contract.startDate')} htmlFor="start_date">
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={defaultStartDate}
                required
              />
            </FormField>
            <FormField label={t('contract.endDate')} htmlFor="end_date">
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={defaultEndDate}
                required
              />
            </FormField>
            <FormField label={t('room.occupants')} htmlFor="occupant_count">
              <Input
                id="occupant_count"
                name="occupant_count"
                type="number"
                min={1}
                defaultValue={defaultOccupantCount}
                required
              />
            </FormField>
            <FormField label={t('room.monthlyRent')} htmlFor="monthly_rent">
              <Input
                id="monthly_rent"
                name="monthly_rent"
                type="number"
                min={0}
                step="0.01"
                defaultValue={defaultMonthlyRent}
                required
              />
            </FormField>
            <FormField label={t('room.deposit')} htmlFor="deposit">
              <Input
                id="deposit"
                name="deposit"
                type="number"
                min={0}
                step="0.01"
                defaultValue={defaultDeposit}
                required
              />
            </FormField>
            <FormField label={t('room.paymentDueDay')} htmlFor="payment_due_day">
              <Input
                id="payment_due_day"
                name="payment_due_day"
                type="number"
                min={1}
                max={28}
                defaultValue={defaultPaymentDueDay}
                required
              />
            </FormField>
          </div>

          <Button type="submit" variant="primary" size="sm" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>

          {state.error ? (
            <p role="alert" className="text-brand-red-deep text-caption">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
