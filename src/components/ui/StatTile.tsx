import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type StatTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red';

const TONE_ACCENT: Record<StatTone, string> = {
  neutral: 'text-ink',
  blue: 'text-brand-blue-deep',
  green: 'text-brand-green-deep',
  yellow: 'text-brand-yellow-deep',
  red: 'text-brand-red-deep',
};

/** Compact, neutral metric surface; color reinforces the value's meaning. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('glass-surface border-border min-w-0 rounded-lg border p-4', className)}>
      <div className="flex min-h-5 items-start justify-between gap-2">
        <p className="text-ink-muted text-caption font-medium">{label}</p>
        {icon ? <span className={cn('shrink-0 pt-0.5', TONE_ACCENT[tone])}>{icon}</span> : null}
      </div>
      <p
        className={cn(
          'mt-2 min-w-0 text-2xl leading-8 font-medium break-words tabular-nums',
          TONE_ACCENT[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-ink-muted text-caption mt-1">{hint}</p> : null}
    </div>
  );
}
