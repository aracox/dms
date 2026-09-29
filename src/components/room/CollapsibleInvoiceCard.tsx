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
 */
export function CollapsibleInvoiceCard({
  title,
  description,
  action,
  defaultOpen,
  children,
}: {
  title: string;
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
