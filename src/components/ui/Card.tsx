import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Surface container, per design/questui-DESIGN.md's card spec.
 *
 * `accent` adds the 2px top border the system reserves for headline cards.
 * `elevated` raises the shadow and fades in the accent glow on hover over
 * 300ms -- the spec's preferred timing (Don't #9: no faster, no flashier).
 */
export function Card({
  className,
  accent,
  elevated,
  children,
}: {
  className?: string;
  accent?: boolean;
  elevated?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'bg-surface rounded-md border',
        elevated
          ? 'border-brand-yellow/40 hover:shadow-glow shadow-lg transition-shadow duration-300'
          : 'border-border shadow-sm',
        accent && 'border-t-brand-yellow border-t-2',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'border-border flex items-start justify-between gap-4 border-b px-6 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-ink font-display text-h4 font-semibold">{title}</h2>
        {description ? <p className="text-ink-muted text-caption mt-1">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-6', className)}>{children}</div>;
}

/** Label/value row. The workhorse of the room detail panels. */
export function Field({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('py-2', className)}>
      <dt className="text-ink-muted text-caption">{label}</dt>
      <dd className="text-ink text-body-sm mt-1 font-medium">{value}</dd>
      {hint ? <p className="text-ink-subtle text-caption mt-1">{hint}</p> : null}
    </div>
  );
}

export function FieldGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </dl>
  );
}
