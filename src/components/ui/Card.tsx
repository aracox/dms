import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/** Content surface that follows the shared glass transparency preference. */
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
        'glass-surface overflow-hidden rounded-lg border',
        elevated ? 'border-border shadow-lg' : 'border-border',
        accent && 'border-t-brand-blue border-t-2',
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
        'border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-ink font-display text-h4 font-medium">{title}</h2>
        {description ? <p className="text-ink-muted text-caption mt-1">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>;
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
