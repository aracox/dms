'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useActionState } from 'react';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { PROPERTY_SEGMENTS, viewSegments, type SegmentView } from '@/lib/reporting/segments';
import { updatePropertyNamesAction, type SettingsState } from '@/lib/settings/actions';
import type { PropertyIdentity } from '@/lib/settings/queries';
import { cn } from '@/lib/utils/cn';
import type { PropertySegment } from '@/types/database';

const INITIAL_STATE: SettingsState = { message: null, error: null };

/**
 * The หอพัก and บ้านพัก names shown on that segment's contract and receipt
 * PDFs. A separate form (and action) from the numeric rates/fees below --
 * text identity and money settings change on different schedules and don't
 * need to share a save button.
 */
export function PropertyNamesForm({
  values,
  view,
}: {
  values: Record<PropertySegment, PropertyIdentity>;
  view: SegmentView;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updatePropertyNamesAction, INITIAL_STATE);

  const visibleSegments = viewSegments(view);

  return (
    <Card>
      <CardHeader
        title={t('settings.propertyNames')}
        description={t('settings.propertyNamesHint')}
      />
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
                  <FormField label={t('settings.nameTh')} htmlFor={`${segment}-name_th`} required>
                    <Input
                      id={`${segment}-name_th`}
                      name={`${segment}.name_th`}
                      defaultValue={values[segment].name_th}
                      maxLength={200}
                      required
                    />
                  </FormField>
                  <FormField label={t('settings.nameEn')} htmlFor={`${segment}-name_en`}>
                    <Input
                      id={`${segment}-name_en`}
                      name={`${segment}.name_en`}
                      defaultValue={values[segment].name_en}
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
