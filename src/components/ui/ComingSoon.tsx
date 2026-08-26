import { Construction } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Honest placeholder for a module whose data layer is complete but whose forms
 * are not yet built. Says where the working equivalent lives today.
 */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-surface flex gap-3 rounded-lg border border-dashed px-4 py-6">
      <Construction size={18} className="text-ink-subtle mt-0.5 shrink-0" aria-hidden="true" />
      <div className="text-ink-muted text-sm">{children}</div>
    </div>
  );
}
