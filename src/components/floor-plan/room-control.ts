'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent, SVGProps } from 'react';

import type { Locale } from '@/i18n/routing';
import { formatAmount } from '@/lib/billing/money';
import type { RoomBoardRow } from '@/types/database';

/**
 * Props that make an SVG room group a control -- shared by the floor plan and
 * the building view so both behave the same.
 *
 * A unit the segment filter excludes keeps its place but stops being a control:
 * not clickable, not focusable, and hidden from screen readers, which read the
 * page's count instead.
 */
export function roomControlProps({
  label,
  selected,
  dimmed,
  onSelect,
}: {
  label: string;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}): SVGProps<SVGGElement> {
  if (dimmed) return { 'aria-hidden': true };
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-pressed': selected,
    onClick: onSelect,
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    },
  };
}

/** Screen-reader name for a room: number, full status, tenant, and any balance. */
export function useRoomLabel(locale: Locale) {
  const t = useTranslations();
  return (room: RoomBoardRow, statusLabel: string) =>
    [
      t('room.title', { roomNumber: room.room_number }),
      statusLabel,
      room.tenant_name ?? '',
      room.outstanding > 0
        ? `${t('billing.outstanding')} ${formatAmount(room.outstanding, locale)}`
        : '',
    ]
      .filter(Boolean)
      .join('. ');
}
