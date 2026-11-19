import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type StatTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red' | 'brown';

const TONE_ACCENT: Record<StatTone, string> = {
  neutral: 'text-ink',
  blue: 'text-brand-blue-deep',
  green: 'text-brand-green-deep',
  yellow: 'text-brand-yellow-deep',
  red: 'text-brand-red-deep',
  brown: 'text-brand-brown-deep',
};

/**
 * Soft fill + edge for `tinted` tiles. Neutral stays on the plain surface.
 *
 * Every tone is a `glass-surface` with its colour as the glass fill: that
 * follows the transparency setting, and it keeps the background-image
 * backplates (globals.css), which skip glass surfaces, off the tile's labels.
 */
const TONE_SURFACE: Record<StatTone, string> = {
  neutral: 'glass-surface border-border',
  blue: 'glass-surface [--glass-fill:var(--color-brand-blue-soft)] border-brand-blue/15',
  green: 'glass-surface [--glass-fill:var(--color-brand-green-soft)] border-brand-green/20',
  yellow: 'glass-surface [--glass-fill:var(--color-brand-yellow-soft)] border-brand-yellow/35',
  red: 'glass-surface [--glass-fill:var(--color-brand-red-soft)] border-brand-red/25',
  brown: 'glass-surface [--glass-fill:var(--color-brand-brown-soft)] border-brand-brown/20',
};

/**
 * Compact metric surface; color reinforces the value's meaning. `tinted`
 * fills the tile with its tone so a row of tiles reads at a glance.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  tinted = false,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  tinted?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border p-4',
        tinted ? TONE_SURFACE[tone] : TONE_SURFACE.neutral,
        className,
      )}
    >
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
