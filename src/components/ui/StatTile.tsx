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

const TONE_RULE: Record<StatTone, string> = {
  neutral: 'bg-border-strong',
  blue: 'bg-brand-blue',
  green: 'bg-brand-green',
  yellow: 'bg-brand-yellow',
  red: 'bg-brand-red',
};

/**
 * Dashboard metric. A 3px coloured rule carries the tone rather than a tinted
 * background, so a row of tiles stays readable at a glance.
 */
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
        'border-border bg-surface relative overflow-hidden rounded-xl border p-4 shadow-sm',
        className,
      )}
    >
      <span
        className={cn('absolute inset-y-0 left-0 w-[3px]', TONE_RULE[tone])}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink-muted text-caption font-medium">{label}</p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', TONE_ACCENT[tone])}>{value}</p>
      {hint ? <p className="text-ink-subtle text-caption mt-0.5">{hint}</p> : null}
    </div>
  );
}
