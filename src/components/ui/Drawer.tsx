'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from './Button';

/**
 * Right-hand side panel for quick room information.
 *
 * Uses a native <dialog> so focus trapping, Escape and the top layer come from
 * the platform rather than from a focus-management library.
 *
 * The slide-in/out is CSS only -- see the `drawer-panel` utility in globals.css
 * for why @starting-style and allow-discrete are both required.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  closeLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop closes; clicking the panel does not.
        if (event.target === dialogRef.current) onClose();
      }}
      className="glass glass-scrim drawer-panel border-surface/50 text-ink m-0 ml-auto h-full max-h-none w-full max-w-md border-l p-0 shadow-xl [--glass-blur:20px] [--glass-opacity:56%] open:flex open:flex-col"
    >
      <header className="border-border flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle ? <p className="text-ink-muted text-caption mt-0.5">{subtitle}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 px-0"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

      {footer ? <footer className="border-border border-t px-4 py-3">{footer}</footer> : null}
    </dialog>
  );
}
