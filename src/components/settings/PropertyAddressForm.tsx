'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Textarea } from '@/components/ui/Input';
import { PROPERTY_SEGMENTS, viewSegments, type SegmentView } from '@/lib/reporting/segments';
import { updatePropertyAddressAction, type SettingsState } from '@/lib/settings/actions';
import { cn } from '@/lib/utils/cn';
import type { PropertySegment } from '@/types/database';

const INITIAL_STATE: SettingsState = { message: null, error: null };

/**
 * The หอพัก and บ้านพัก building address shown alongside the property name
 * in the contract's "ทรัพย์สินที่เช่า" section (migration 0035).
 */
export function PropertyAddressForm({
  values,
  view,
}: {
  values: Record<PropertySegment, string>;
  view: SegmentView;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(updatePropertyAddressAction, INITIAL_STATE);

  const visibleSegments = viewSegments(view);

  return (
    <Card>
      <CardHeader
        title={t('settings.propertyAddress')}
        description={t('settings.propertyAddressHint')}
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROPERTY_SEGMENTS.map((segment) => {
              if (!visibleSegments.includes(segment)) {
                return (
                  <input
                    key={segment}
                    type="hidden"
                    name={`${segment}.address`}
                    value={values[segment]}
                  />
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
                  <FormField label={t('settings.address')} htmlFor={`property-${segment}-address`}>
                    <Textarea
                      id={`property-${segment}-address`}
                      name={`${segment}.address`}
                      defaultValue={values[segment]}
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
