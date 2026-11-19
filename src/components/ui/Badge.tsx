import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red';

/** Tinted fill + matching deep ink, per the status chip spec (no border). */
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  blue: 'bg-brand-blue-soft text-brand-blue-deep',
  green: 'bg-brand-green-soft text-brand-green-deep',
  yellow: 'bg-brand-yellow-soft text-brand-yellow-deep',
  red: 'bg-brand-red-soft text-brand-red-deep',
};

/**
 * Text-first status chip. The label is always rendered, so the tone is a
 * reinforcement of the meaning rather than the only carrier of it.
 *
 * Sentence-case labels stay readable in both Thai and English.
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
        'font-display inline-flex items-center gap-1 rounded-sm px-2 py-0.5',
        'text-caption font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
