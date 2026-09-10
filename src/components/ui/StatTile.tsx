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

const TONE_SURFACE: Record<StatTone, string> = {
  neutral: 'bg-surface-muted',
  blue: 'bg-brand-blue-soft/50',
  green: 'bg-brand-green-soft/50',
  yellow: 'bg-brand-yellow-soft/50',
  red: 'bg-brand-red-soft/50',
};

/** Dashboard metric with a subtle status tint and a clear numeric hierarchy. */
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
    <div
      className={cn(
        'border-border relative overflow-hidden rounded-xl border p-4',
        TONE_SURFACE[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink-muted text-caption font-medium">{label}</p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', TONE_ACCENT[tone])}>{value}</p>
      {hint ? <p className="text-ink-subtle text-caption mt-0.5">{hint}</p> : null}
    </div>
  );
}
