'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Right-hand side panel for quick room information.
 *
 * Uses a native <dialog> so focus trapping, Escape and the top layer come from
 * the platform rather than from a focus-management library.
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
      className="bg-surface text-ink m-0 ml-auto h-full max-h-none w-full max-w-md p-0 backdrop:bg-black/30 open:flex open:flex-col"
    >
      <header className="border-border flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle ? <p className="text-ink-muted mt-0.5 text-xs">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="text-ink-muted hover:bg-surface-sunken hover:text-ink rounded p-1"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

      {footer ? <footer className="border-border border-t px-4 py-3">{footer}</footer> : null}
    </dialog>
  );
}
