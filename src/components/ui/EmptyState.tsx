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
        // rounded-md, not the panel radius: this sits nested inside a Card, and
        // a child with a larger radius than its container reads as misaligned.
        'border-border text-ink-subtle text-body-sm flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6',
        className,
      )}
    >
      {icon}
      {message}
    </p>
  );
}
