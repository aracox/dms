import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/** Dense data table. Wraps itself in a horizontal scroller so pages never do. */
export function Table({
  head,
  children,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('text-body-sm w-full min-w-[32rem] border-collapse', className)}>
        <thead className="border-border bg-surface-muted/70 text-ink-muted font-display text-caption border-b text-left">
          {head}
        </thead>
        <tbody className="divide-border [&>tr:hover]:bg-brand-blue/5 divide-y [&>tr]:transition-colors">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function TH({
  children,
  numeric,
  className,
}: {
  children?: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn('px-3 py-2 font-medium whitespace-nowrap', numeric && 'text-right', className)}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  numeric,
  className,
}: {
  children?: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'h-10 px-3 py-2 align-middle',
        numeric && 'text-right whitespace-nowrap tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  );
}
