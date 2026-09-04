'use client';

import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface TabDefinition {
  id: string;
  label: ReactNode;
  /** Server-rendered content is fine here -- it arrives as an RSC payload. */
  content: ReactNode;
  badge?: ReactNode;
}

/**
 * Tab strip with roving focus and arrow-key navigation, per the WAI-ARIA tabs
 * pattern. All panels are rendered and the inactive ones hidden, so the browser
 * can still find text on them.
 */
export function Tabs({
  tabs,
  initialTabId,
  className,
}: {
  tabs: TabDefinition[];
  initialTabId?: string;
  className?: string;
}) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(initialTabId ?? tabs[0]?.id ?? '');

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId),
  );

  function focusTab(index: number) {
    const target = tabs[(index + tabs.length) % tabs.length];
    if (!target) return;
    setActiveId(target.id);
    document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  focusTab(index + 1);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  focusTab(index - 1);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  focusTab(0);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  focusTab(tabs.length - 1);
                }
              }}
              className={cn(
                'font-display text-body-sm -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 font-semibold whitespace-nowrap',
                'transition-colors duration-150',
                isActive
                  ? 'border-brand-blue text-brand-blue-deep'
                  : 'text-ink-muted hover:text-ink hover:border-border-strong border-transparent',
              )}
            >
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={index !== activeIndex}
          className="pt-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
