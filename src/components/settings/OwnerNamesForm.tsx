'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useActionState } from 'react';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { PROPERTY_SEGMENTS, viewSegments, type SegmentView } from '@/lib/reporting/segments';
import { updateOwnerNamesAction, type SettingsState } from '@/lib/settings/actions';
import type { OwnerIdentity } from '@/lib/settings/queries';
import { cn } from '@/lib/utils/cn';
import type { PropertySegment } from '@/types/database';

const INITIAL_STATE: SettingsState = { message: null, error: null };

/**
 * The หอพัก and บ้านพัก owner identity (name, ID card, address, phone) shown
 * as the lessor party on that segment's contract PDF -- distinct from
 * PropertyNamesForm, which names the place, not the person who signs. A
 * separate form (and action) so it can be saved on its own.
 */
export function OwnerNamesForm({
  values,
  view,
}: {
  values: Record<PropertySegment, OwnerIdentity>;
  view: SegmentView;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updateOwnerNamesAction, INITIAL_STATE);

  const visibleSegments = viewSegments(view);

  return (
    <Card>
      <CardHeader title={t('settings.ownerNames')} description={t('settings.ownerNamesHint')} />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROPERTY_SEGMENTS.map((segment) => {
              if (!visibleSegments.includes(segment)) {
                return (
                  <Fragment key={segment}>
                    <input
                      type="hidden"
                      name={`${segment}.name_th`}
                      value={values[segment].name_th}
                    />
                    <input
                      type="hidden"
                      name={`${segment}.name_en`}
                      value={values[segment].name_en}
                    />
                    <input
                      type="hidden"
                      name={`${segment}.id_card`}
                      value={values[segment].id_card}
                    />
                    <input
                      type="hidden"
                      name={`${segment}.address`}
                      value={values[segment].address}
                    />
                    <input type="hidden" name={`${segment}.phone`} value={values[segment].phone} />
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
                  <FormField
                    label={t('settings.nameTh')}
                    htmlFor={`owner-${segment}-name_th`}
                    required
                  >
                    <Input
                      id={`owner-${segment}-name_th`}
                      name={`${segment}.name_th`}
                      defaultValue={values[segment].name_th}
                      maxLength={200}
                      required
                    />
                  </FormField>
                  <FormField label={t('settings.nameEn')} htmlFor={`owner-${segment}-name_en`}>
                    <Input
                      id={`owner-${segment}-name_en`}
                      name={`${segment}.name_en`}
                      defaultValue={values[segment].name_en}
                      maxLength={200}
                    />
                  </FormField>
                  <FormField label={t('settings.idCard')} htmlFor={`owner-${segment}-id_card`}>
                    <Input
                      id={`owner-${segment}-id_card`}
                      name={`${segment}.id_card`}
                      defaultValue={values[segment].id_card}
                      maxLength={50}
                    />
                  </FormField>
                  <FormField label={t('settings.phone')} htmlFor={`owner-${segment}-phone`}>
                    <Input
                      id={`owner-${segment}-phone`}
                      name={`${segment}.phone`}
                      defaultValue={values[segment].phone}
                      maxLength={20}
                    />
                  </FormField>
                  <FormField label={t('settings.address')} htmlFor={`owner-${segment}-address`}>
                    <Textarea
                      id={`owner-${segment}-address`}
                      name={`${segment}.address`}
                      defaultValue={values[segment].address}
                      maxLength={500}
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
