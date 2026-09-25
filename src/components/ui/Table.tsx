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
        <thead className="border-brand-blue/30 bg-brand-blue-soft text-brand-blue-deep font-display text-caption border-b text-left">
          {head}
        </thead>
        <tbody className="divide-border [&>tr:hover]:bg-surface-muted divide-y [&>tr]:transition-colors">
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
    <th scope="col" className={cn('px-4 py-3 font-medium', numeric && 'text-right', className)}>
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
    // h-12 pins the spec's 48px row height; padding alone drifts with content.
    <td className={cn('h-12 px-4 py-3', numeric && 'text-right font-mono tabular-nums', className)}>
      {children}
    </td>
  );
}
