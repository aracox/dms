import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Shared control box for text inputs and selects: 40px tall, 8px/12px padding,
 * 4px radius, per design/questui-DESIGN.md.
 *
 * One deliberate deviation from the spec: focus keeps the border at 1px and
 * leans on the ring for emphasis instead of thickening to 2px. A width change
 * on focus reflows the control's content by a pixel, which is distracting in
 * the dense meter/billing forms where fields sit shoulder to shoulder.
 */
const CONTROL_BASE = [
  'h-10 w-full rounded-md border bg-surface px-3 py-2 text-body-sm text-ink',
  'transition-colors duration-150',
  'placeholder:text-ink-subtle',
  'focus:outline-none focus:ring-3',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 disabled:hover:border-border',
].join(' ');

const CONTROL_TONE = {
  default: 'border-border hover:border-brand-blue focus:border-brand-blue focus:ring-brand-blue/25',
  error:
    'border-brand-red hover:border-brand-red focus:border-brand-red focus:ring-brand-red/25 bg-brand-red-soft/30',
} as const;

function controlClasses(invalid: boolean | undefined, className: string | undefined) {
  return cn(CONTROL_BASE, invalid ? CONTROL_TONE.error : CONTROL_TONE.default, className);
}

export function Input({
  invalid,
  className,
  ...props
}: ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, className)}
      {...props}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn('pr-8', className))}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * Label + control + helper/error, with the spec's label (14px/500, 6px gap)
 * and helper/error (12px, 4px gap) treatments.
 *
 * `error` wins over `hint` when both are present -- a stale hint under a failed
 * field reads as contradictory advice.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="text-ink text-body-sm mb-1.5 block font-medium">
        {label}
        {required ? (
          <span className="text-brand-red-deep ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-brand-red-deep text-caption mt-1 font-normal">{error}</p>
      ) : hint ? (
        <p className="text-ink-muted text-caption mt-1 font-normal">{hint}</p>
      ) : null}
    </div>
  );
}
