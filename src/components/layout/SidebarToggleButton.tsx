'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

import { useSidebar } from './SidebarState';

/**
 * Lives inside the sidebar itself (DesktopSidebar), not the toolbar -- it
 * needs to stay reachable even when the nav list is hidden, so it sits in
 * the narrow rail that remains.
 */
export function SidebarToggleButton() {
  const t = useTranslations('nav');
  const { hidden, toggle } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'size-8 shrink-0 border-transparent px-0 text-white',
        'hover:bg-white/12 hover:text-white',
      )}
      aria-label={hidden ? t('showSidebar') : t('hideSidebar')}
      aria-pressed={hidden}
      onClick={toggle}
    >
      {hidden ? (
        <PanelLeftOpen size={18} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={18} aria-hidden="true" />
      )}
    </Button>
  );
}
