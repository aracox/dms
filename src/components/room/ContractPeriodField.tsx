'use client';

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Locale } from '@/i18n/routing';
import { updateContractPeriodAction } from '@/lib/contracts/actions';
import { formatDate } from '@/lib/utils/date';

/**
 * The active contract's start/end dates, editable in place. Looks like
 * InlineEditableField in read mode, but two dates need an explicit Save
 * rather than commit-on-blur -- tabbing from one date to the other would
 * otherwise submit a half-edited period.
 *
 * Displays the dates the server sent (no private copy -- the Overview and
 * Contract tabs both render this at once, and the action revalidates the page).
 */
export function ContractPeriodField({
  contractId,
  roomId,
  startDate,
  endDate,
  locale,
  hint,
}: {
  contractId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  locale: Locale;
  /** Read-mode note under the value, e.g. days remaining. */
  hint?: ReactNode;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState({ start: startDate, end: endDate });
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  function startEditing() {
    setDraft({ start: startDate, end: endDate });
    setError(null);
    setEditing(true);
  }

  async function save() {
    setPending(true);
    const formData = new FormData();
    formData.set('contract_id', contractId);
    formData.set('room_id', roomId);
    formData.set('start_date', draft.start);
    formData.set('end_date', draft.end);

    const result = await updateContractPeriodAction({ error: null }, formData);
    setPending(false);
    if (result.error) {
      setError({ message: result.error, field: result.field });
      return;
    }
    setEditing(false);
  }

  const label = t('room.contractPeriod');

  if (!editing) {
    return (
      <div className="py-2">
        <dt className="text-ink-muted text-caption">{label}</dt>
        <dd
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') startEditing();
          }}
          className="group text-ink hover:bg-surface-sunken hover:ring-border -mx-1 mt-0.5 flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium ring-1 ring-transparent"
        >
          <span>
            {formatDate(startDate, locale)} — {formatDate(endDate, locale)}
          </span>
          <Pencil
            size={12}
            aria-hidden="true"
            className="text-ink-subtle group-hover:text-brand-blue shrink-0"
          />
        </dd>
        {hint ? <p className="text-ink-subtle text-caption mt-0.5">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="py-2">
      <dt className="text-ink-muted text-caption">{label}</dt>
      <dd className="mt-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-ink-subtle text-caption">
            {t('contract.startDate')}
            <Input
              type="date"
              value={draft.start}
              onChange={(event) => setDraft({ ...draft, start: event.target.value })}
              disabled={pending}
              invalid={error?.field === 'start_date'}
              className="mt-0.5"
            />
          </label>
          <label className="text-ink-subtle text-caption">
            {t('contract.endDate')}
            <Input
              type="date"
              value={draft.end}
              onChange={(event) => setDraft({ ...draft, end: event.target.value })}
              disabled={pending}
              invalid={error?.field === 'end_date'}
              className="mt-0.5"
            />
          </label>
        </div>
        {error ? (
          <p className="text-brand-red-deep text-caption">{t(error.message)}</p>
        ) : (
          <p className="text-ink-subtle text-caption">{t('contract.periodEditHint')}</p>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="primary" size="sm" onClick={save} disabled={pending}>
            {pending ? t('common.loading') : t('common.save')}
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </dd>
    </div>
  );
}
