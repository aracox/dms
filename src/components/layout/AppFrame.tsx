'use client';

import type { ReactNode } from 'react';

import { useSidebar } from './SidebarState';

/** Reads the sidebar toggle state so the grid layout in globals.css can react to it. */
export function AppFrame({ children }: { children: ReactNode }) {
  const { hidden } = useSidebar();

  return (
    <div className="app-frame min-h-dvh" data-sidebar-hidden={hidden ? 'true' : undefined}>
      {children}
    </div>
  );
}
