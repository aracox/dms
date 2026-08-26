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
      <table className={cn('w-full min-w-[32rem] border-collapse text-sm', className)}>
        <thead className="border-border text-ink-muted border-b text-left text-xs">{head}</thead>
        <tbody className="divide-border divide-y">{children}</tbody>
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
    <th scope="col" className={cn('px-3 py-2 font-medium', numeric && 'text-right', className)}>
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
    <td className={cn('px-3 py-2', numeric && 'text-right tabular-nums', className)}>{children}</td>
  );
}
