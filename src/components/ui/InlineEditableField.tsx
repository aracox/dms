'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * A field that edits in place, DataTables-Editor style: click the value to
 * turn it into an input, Enter/blur commits, Escape reverts. No separate
 * "edit mode" for the whole card -- each field commits independently.
 */
export function InlineEditableField({
  label,
  value,
  emptyLabel,
  onCommit,
}: {
  label: string;
  value: string;
  emptyLabel: string;
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
      <dt className="text-ink-muted text-xs">{label}</dt>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="border-brand-blue bg-surface text-ink mt-0.5 w-full rounded-md border px-2 py-1 text-sm outline-none disabled:opacity-60"
        />
      ) : (
        <dd
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') startEditing();
          }}
          className="text-ink hover:bg-surface-sunken hover:ring-border -mx-1 mt-0.5 cursor-text rounded px-1 py-0.5 text-sm font-medium ring-1 ring-transparent"
        >
          {value || <span className="text-ink-subtle">{emptyLabel}</span>}
        </dd>
      )}
      {error ? <p className="text-brand-red-deep mt-0.5 text-xs">{t(error)}</p> : null}
    </div>
  );
}
