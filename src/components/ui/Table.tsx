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
        {/*
         * Uppercase, tracked, display face -- the spec's treatment for small
         * labels (Do #10). Reads as inscribed column headings rather than data.
         */}
        <thead className="border-border text-ink-muted font-display border-b text-left text-[11px] tracking-[1px] uppercase">
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
    <th scope="col" className={cn('px-4 py-3 font-normal', numeric && 'text-right', className)}>
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
