import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('border-border bg-surface rounded-lg border', className)}>
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
        'border-border flex items-start justify-between gap-4 border-b px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-ink text-sm font-semibold">{title}</h2>
        {description ? <p className="text-ink-muted mt-0.5 text-xs">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-4 py-3', className)}>{children}</div>;
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
      <dt className="text-ink-muted text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 text-sm font-medium">{value}</dd>
      {hint ? <p className="text-ink-subtle mt-0.5 text-xs">{hint}</p> : null}
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
