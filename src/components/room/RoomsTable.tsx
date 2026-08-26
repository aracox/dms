'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { FLOORS } from '@/config/floor-layout';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { formatDate } from '@/lib/utils/date';
import type { RoomBoardRow, RoomStatus } from '@/types/database';

const STATUSES: RoomStatus[] = ['occupied', 'vacant', 'reserved', 'maintenance'];

/** Dense table view of the same data the floor plan shows. */
export function RoomsTable({ rooms, locale }: { rooms: RoomBoardRow[]; locale: Locale }) {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  const [floor, setFloor] = useState<number | 'all'>('all');
  const [status, setStatus] = useState<RoomStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rooms.filter((room) => {
      if (floor !== 'all' && room.floor !== floor) return false;
      if (status !== 'all' && room.room_status !== status) return false;
      if (!needle) return true;
      return (
        room.room_number.toLowerCase().includes(needle) ||
        (room.tenant_name ?? '').toLowerCase().includes(needle) ||
        (room.tenant_phone ?? '').includes(needle)
      );
    });
  }, [rooms, query, floor, status]);

  const selectClass = 'rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="room-search" className="text-ink-muted block text-xs font-medium">
            {t('common.search')}
          </label>
          <div className="relative mt-1">
            <Search
              size={14}
              className="text-ink-subtle absolute top-1/2 left-2.5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="room-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('rooms.searchPlaceholder')}
              className="border-border bg-surface text-ink w-full rounded-md border py-1.5 pr-3 pl-8 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="room-floor" className="text-ink-muted block text-xs font-medium">
            {t('rooms.filterByFloor')}
          </label>
          <select
            id="room-floor"
            value={String(floor)}
            onChange={(event) =>
              setFloor(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className={`mt-1 ${selectClass}`}
          >
            <option value="all">{t('rooms.allFloors')}</option>
            {FLOORS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t('floorPlan.floor', { floor: candidate })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="room-status" className="text-ink-muted block text-xs font-medium">
            {t('rooms.filterByStatus')}
          </label>
          <select
            id="room-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as RoomStatus | 'all')}
            className={`mt-1 ${selectClass}`}
          >
            <option value="all">{t('rooms.allStatuses')}</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`roomStatus.${candidate}`)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-ink-subtle ml-auto text-xs" aria-live="polite">
          {t('rooms.resultCount', { count: filtered.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={t('rooms.noResults')} />
      ) : (
        <div className="border-border bg-surface rounded-lg border">
          <Table
            head={
              <tr>
                <TH>{t('room.roomNumber')}</TH>
                <TH>{t('room.floor')}</TH>
                <TH>{t('common.status')}</TH>
                <TH>{t('room.mainTenant')}</TH>
                <TH numeric>{t('room.occupants')}</TH>
                <TH numeric>{t('room.monthlyRent')}</TH>
                <TH>{t('billing.dueDate')}</TH>
                <TH numeric>{t('billing.outstanding')}</TH>
              </tr>
            }
          >
            {filtered.map((room) => (
              <tr key={room.room_id} className="hover:bg-surface-muted">
                <TD>
                  <Link
                    href={`/rooms/${room.room_id}`}
                    className="text-brand-blue-deep font-semibold underline"
                  >
                    {room.room_number}
                  </Link>
                </TD>
                <TD>{room.floor}</TD>
                <TD>
                  <RoomStatusBadge
                    roomStatus={room.room_status}
                    financialStatus={room.financial_status}
                  />
                </TD>
                <TD>
                  {room.tenant_name ?? (
                    <span className="text-ink-subtle">{t('room.noTenant')}</span>
                  )}
                  {room.tenant_phone ? (
                    <span className="text-ink-subtle block text-xs">{room.tenant_phone}</span>
                  ) : null}
                </TD>
                <TD numeric>{room.occupant_count ?? '-'}</TD>
                <TD numeric>{formatTHB(room.monthly_rent, locale)}</TD>
                <TD>{room.due_date ? formatDate(room.due_date, locale) : '-'}</TD>
                <TD numeric className={room.outstanding > 0 ? 'font-medium' : 'text-ink-subtle'}>
                  {room.outstanding > 0 ? formatTHB(room.outstanding, locale) : '-'}
                </TD>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
