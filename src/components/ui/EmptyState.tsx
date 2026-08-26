import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export function EmptyState({
  message,
  icon,
  className,
}: {
  message: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'border-border text-ink-subtle flex items-center justify-center gap-2 rounded border border-dashed px-4 py-6 text-sm',
        className,
      )}
    >
      {icon}
      {message}
    </p>
  );
}
