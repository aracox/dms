'use client';

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Input } from './Input';

/**
 * A field that edits in place, DataTables-Editor style: click the value to
 * turn it into an input, Enter/blur commits, Escape reverts. No separate
 * "edit mode" for the whole card -- each field commits independently.
 *
 * The pencil is always visible, not just on hover: without it an editable
 * value looks identical to a read-only one, and touch screens have no hover.
 */
export function InlineEditableField({
  label,
  value,
  displayValue,
  emptyLabel,
  hint,
  inputType = 'text',
  onCommit,
}: {
  label: string;
  value: string;
  /** Read-mode rendering, e.g. comma-grouped, when it must differ from the raw editable value. */
  displayValue?: string;
  emptyLabel: string;
  hint?: ReactNode;
  inputType?: 'text' | 'number';
  onCommit: (value: string) => Promise<string | null>;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  async function commit() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setPending(true);
    const nextError = await onCommit(draft);
    setPending(false);
    setError(nextError);
    if (!nextError) setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      inputRef.current?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      skipCommitRef.current = true;
      setDraft(value);
      inputRef.current?.blur();
    }
  }

  async function handleBlur() {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditing(false);
      setError(null);
      return;
    }
    await commit();
  }

  return (
    <div className="py-2">
      <dt className="text-ink-muted text-caption">{label}</dt>
      {editing ? (
        <Input
          ref={inputRef}
          type={inputType}
          value={draft}
          disabled={pending}
          invalid={Boolean(error)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="mt-0.5"
        />
      ) : (
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
            {(displayValue ?? value) || <span className="text-ink-subtle">{emptyLabel}</span>}
          </span>
          <Pencil
            size={12}
            aria-hidden="true"
            className="text-ink-subtle group-hover:text-brand-blue shrink-0"
          />
        </dd>
      )}
      {error ? (
        <p className="text-brand-red-deep text-caption mt-0.5">{t(error)}</p>
      ) : hint ? (
        <p className="text-ink-subtle text-caption mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}
