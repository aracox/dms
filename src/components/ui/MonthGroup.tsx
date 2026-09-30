'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

/**
 * Which month groups of a month-grouped table are unfolded. Only the newest month
 * starts open; older months fold to their heading row (month, total, count).
 */
export function useOpenMonths(newestMonth: string | undefined) {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(newestMonth ? [newestMonth] : []),
  );

  return {
    isOpen: (month: string) => open.has(month),
    toggle: (month: string) =>
      setOpen((previous) => {
        const next = new Set(previous);
        if (next.has(month)) next.delete(month);
        else next.add(month);
        return next;
      }),
  };
}

/** The month cell of a group's heading row; the whole label is the toggle. */
export function MonthToggleCell({
  label,
  open,
  onToggle,
  colSpan,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <td colSpan={colSpan} className="text-ink h-12 px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-left"
      >
        <Chevron size={16} aria-hidden="true" className="shrink-0" />
        {label}
      </button>
    </td>
  );
}
