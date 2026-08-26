import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-border-strong',
  blue: 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue',
  green: 'bg-brand-green-soft text-brand-green-deep border-brand-green',
  yellow: 'bg-brand-yellow-soft text-brand-yellow-deep border-brand-yellow',
  red: 'bg-brand-red-soft text-brand-red-deep border-brand-red',
};

/**
 * Text-first badge. The label is always rendered, so the tone is a reinforcement
 * of the meaning rather than the only carrier of it.
 */
export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
