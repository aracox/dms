'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Card, CardHeader } from '@/components/ui/Card';

/**
 * One bill on a room's billing list, foldable to just its title bar. The bar
 * keeps the status and the cancel/delete actions, and its description carries
 * the total and outstanding, so a folded bill still says what matters. Only
 * the title toggles -- the actions sit outside the button so clicking them
 * never folds the card.
 *
 * The status pill sits beside the title, not among the actions: next to the
 * buttons, a boxed status read as one more thing to click.
 */
export function CollapsibleInvoiceCard({
  title,
  status,
  description,
  action,
  defaultOpen,
  children,
}: {
  title: string;
  /** Status pill shown right after the title. */
  status: ReactNode;
  description: string;
  action: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls={bodyId}
              className="flex items-center gap-1.5 text-left"
            >
              <Chevron size={18} aria-hidden="true" className="shrink-0" />
              {title}
            </button>
            {status}
          </span>
        }
        description={description}
        action={action}
      />
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </Card>
  );
}
