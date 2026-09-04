'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import type { AppRole } from '@/types/database';

import { Sidebar } from './Sidebar';

export function MobileNavigation({ role }: { role: AppRole | null }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-9 px-0"
        aria-label={t('nav.openMenu')}
        onClick={() => setOpen(true)}
      >
        <Menu size={19} aria-hidden="true" />
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t('nav.menu')}
        subtitle={t('app.name')}
        closeLabel={t('nav.closeMenu')}
      >
        <Sidebar role={role} onNavigate={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}
