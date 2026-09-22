'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useActionState } from 'react';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { PROPERTY_SEGMENTS, viewSegments, type SegmentView } from '@/lib/reporting/segments';
import { updatePaymentBankAction, type SettingsState } from '@/lib/settings/actions';
import type { PaymentBank } from '@/lib/settings/queries';
import { cn } from '@/lib/utils/cn';
import type { PropertySegment } from '@/types/database';

const INITIAL_STATE: SettingsState = { message: null, error: null };

/**
 * The หอพัก and บ้านพัก bank account shown in the contract's payment clause
 * (ช่องทางการชำระเงิน). Segment-scoped like the identity forms above -- dorm
 * and house may settle into different accounts.
 */
export function PaymentBankForm({
  values,
  view,
}: {
  values: Record<PropertySegment, PaymentBank>;
  view: SegmentView;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updatePaymentBankAction, INITIAL_STATE);

  const visibleSegments = viewSegments(view);

  return (
    <Card>
      <CardHeader title={t('settings.paymentBank')} description={t('settings.paymentBankHint')} />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROPERTY_SEGMENTS.map((segment) => {
              if (!visibleSegments.includes(segment)) {
                return (
                  <Fragment key={segment}>
                    <input
                      type="hidden"
                      name={`${segment}.bank_name`}
                      value={values[segment].bank_name}
                    />
                    <input
                      type="hidden"
                      name={`${segment}.account_number`}
                      value={values[segment].account_number}
                    />
                    <input
                      type="hidden"
                      name={`${segment}.account_name`}
                      value={values[segment].account_name}
                    />
                  </Fragment>
                );
              }

              return (
                <div key={segment} className="border-border space-y-3 rounded-md border p-3">
                  <span className="text-ink-subtle font-display flex items-center gap-1.5 text-[11px] tracking-[1px] uppercase">
                    <span
                      className={cn('size-2.5 rounded-sm', SEGMENT_STYLES[segment].fill)}
                      aria-hidden="true"
                    />
                    {t(`segment.${segment}`)}
                  </span>
                  <FormField label={t('settings.bankName')} htmlFor={`bank-${segment}-bank_name`}>
                    <Input
                      id={`bank-${segment}-bank_name`}
                      name={`${segment}.bank_name`}
                      defaultValue={values[segment].bank_name}
                      maxLength={200}
                    />
                  </FormField>
                  <FormField
                    label={t('settings.accountNumber')}
                    htmlFor={`bank-${segment}-account_number`}
                  >
                    <Input
                      id={`bank-${segment}-account_number`}
                      name={`${segment}.account_number`}
                      defaultValue={values[segment].account_number}
                      maxLength={50}
                    />
                  </FormField>
                  <FormField
                    label={t('settings.accountName')}
                    htmlFor={`bank-${segment}-account_name`}
                  >
                    <Input
                      id={`bank-${segment}-account_name`}
                      name={`${segment}.account_name`}
                      defaultValue={values[segment].account_name}
                      maxLength={200}
                    />
                  </FormField>
                </div>
              );
            })}
          </div>

          {state.error ? (
            <p
              role="alert"
              className="border-brand-red bg-brand-red-soft text-brand-red-deep text-caption rounded-md border px-3 py-2"
            >
              {t(state.error)}
            </p>
          ) : null}

          {state.message ? (
            <p
              role="status"
              className="border-brand-green bg-brand-green-soft text-brand-green-deep text-caption rounded-md border px-3 py-2"
            >
              {t(state.message)}
            </p>
          ) : null}

          <Button variant="primary" size="md" type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
