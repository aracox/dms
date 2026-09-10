'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

const STORAGE_KEY = 'dms:sidebar-hidden';
const CHANGE_EVENT = 'dms:sidebar-hidden-change';

function getStoredHidden() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const SidebarContext = createContext<{ hidden: boolean; toggle: () => void } | null>(null);

/** Persists the desktop sidebar's hidden/shown state across reloads. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(subscribe, getStoredHidden, () => false);

  const toggle = () => {
    try {
      localStorage.setItem(STORAGE_KEY, hidden ? '0' : '1');
    } catch {
      // localStorage unavailable (private browsing, blocked site data) -- toggle
      // still fires the change event below so it works for this page load.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return <SidebarContext.Provider value={{ hidden, toggle }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
  return ctx;
}
