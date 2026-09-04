'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input, Select } from '@/components/ui/Input';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <FormField label={t('common.search')} htmlFor="room-search" className="min-w-56 flex-1">
          <div className="relative">
            <Search
              size={14}
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="room-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('rooms.searchPlaceholder')}
              className="pl-9"
            />
          </div>
        </FormField>

        <FormField label={t('rooms.filterByFloor')} htmlFor="room-floor">
          <Select
            id="room-floor"
            value={String(floor)}
            onChange={(event) =>
              setFloor(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="w-auto"
          >
            <option value="all">{t('rooms.allFloors')}</option>
            {FLOORS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t('floorPlan.floor', { floor: candidate })}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('rooms.filterByStatus')} htmlFor="room-status">
          <Select
            id="room-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as RoomStatus | 'all')}
            className="w-auto"
          >
            <option value="all">{t('rooms.allStatuses')}</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`roomStatus.${candidate}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <p className="text-ink-subtle text-caption ml-auto" aria-live="polite">
          {t('rooms.resultCount', { count: filtered.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={t('rooms.noResults')} />
      ) : (
        <div className="border-border glass rounded-md border shadow-sm">
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
                    <span className="text-ink-subtle text-caption block">{room.tenant_phone}</span>
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
