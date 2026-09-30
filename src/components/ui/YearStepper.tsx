'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

/**
 * `[ ‹ ] ปี 2569 [ › ]` for client-side year paging (no navigation). Only the
 * current year is printed; the neighbouring year lives in each arrow's label.
 * A missing handler renders that arrow faded and inert. Matches the reports
 * page's link-based stepper, which switches years through the URL instead.
 */
export function YearStepper({
  label,
  navigationLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: {
  label: string;
  navigationLabel: string;
  previousLabel?: string;
  nextLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const step = (
    direction: 'previous' | 'next',
    onClick: (() => void) | undefined,
    title: string | undefined,
  ) => {
    const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
    const edge = direction === 'previous' ? 'border-r' : 'border-l';
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        title={title}
        className={cn(
          'border-border text-ink hover:bg-surface-sunken flex items-center px-2.5 transition-colors',
          edge,
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    ) : (
      <span
        aria-hidden="true"
        className={cn('border-border text-ink-subtle/40 flex items-center px-2.5', edge)}
      >
        <Icon size={18} />
      </span>
    );
  };

  return (
    <nav
      aria-label={navigationLabel}
      className="border-border bg-surface flex h-9 items-stretch overflow-hidden rounded-md border"
    >
      {step('previous', onPrevious, previousLabel)}
      <span
        className="text-ink flex min-w-24 items-center justify-center px-4 font-semibold whitespace-nowrap"
        aria-live="polite"
      >
        {label}
      </span>
      {step('next', onNext, nextLabel)}
    </nav>
  );
}
