'use client';

import { Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Input';
import { TD, TH, Table } from '@/components/ui/Table';
import { FLOORS } from '@/config/floor-layout';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { propertySegment } from '@/lib/reporting/segments';
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
    <div className="glass-surface border-border overflow-hidden rounded-lg border">
      <div className="border-border flex flex-wrap items-center gap-3 border-b p-3">
        <div className="min-w-48 flex-1 sm:max-w-sm">
          <label htmlFor="room-search" className="sr-only">
            {t('common.search')}
          </label>
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
        </div>

        <div>
          <label htmlFor="room-floor" className="sr-only">
            {t('rooms.filterByFloor')}
          </label>
          <Select
            id="room-floor"
            value={String(floor)}
            onChange={(event) =>
              setFloor(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="w-32"
          >
            <option value="all">{t('rooms.allFloors')}</option>
            {FLOORS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t('floorPlan.floor', { floor: candidate })}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="room-status" className="sr-only">
            {t('rooms.filterByStatus')}
          </label>
          <Select
            id="room-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as RoomStatus | 'all')}
            className="w-36"
          >
            <option value="all">{t('rooms.allStatuses')}</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`roomStatus.${candidate}`)}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-ink-subtle text-caption ml-auto" aria-live="polite">
          {t('rooms.resultCount', { count: filtered.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState message={t('rooms.noResults')} />
        </div>
      ) : (
        <Table
          className="min-w-[46rem]"
          head={
            <tr>
              <TH>{t('room.roomNumber')}</TH>
              <TH>{t('common.status')}</TH>
              <TH>{t('room.mainTenant')}</TH>
              <TH numeric>{t('room.monthlyRent')}</TH>
              <TH>{t('billing.dueDate')}</TH>
              <TH numeric>{t('billing.outstanding')}</TH>
            </tr>
          }
        >
          {filtered.map((room) => (
            <tr key={room.room_id}>
              <TD className="whitespace-nowrap">
                <Link
                  href={`/rooms/${room.room_id}`}
                  className="text-brand-blue-deep font-semibold hover:underline"
                >
                  {room.room_number}
                </Link>
                <span className="text-ink-muted text-caption mt-0.5 block">
                  {t(`segment.${propertySegment(room.room_type)}`)} ·{' '}
                  {t('floorPlan.floor', { floor: room.floor })}
                </span>
              </TD>
              <TD className="whitespace-nowrap">
                <RoomStatusBadge
                  roomStatus={room.room_status}
                  financialStatus={room.financial_status}
                  hasNotice={Boolean(room.notice_given_at)}
                />
              </TD>
              <TD>
                {room.tenant_name ?? <span className="text-ink-subtle">{t('room.noTenant')}</span>}
                <span className="text-ink-muted text-caption mt-0.5 flex items-center gap-2">
                  {room.tenant_phone ? <span>{room.tenant_phone}</span> : null}
                  {room.occupant_count != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} aria-hidden="true" />
                      {t('room.occupantsValue', { count: room.occupant_count })}
                    </span>
                  ) : null}
                </span>
              </TD>
              <TD numeric>{formatTHB(room.monthly_rent, locale)}</TD>
              <TD className="whitespace-nowrap">
                {room.due_date ? formatDate(room.due_date, locale) : '-'}
              </TD>
              <TD numeric className={room.outstanding > 0 ? 'font-medium' : 'text-ink-subtle'}>
                {room.outstanding > 0 ? formatTHB(room.outstanding, locale) : '-'}
              </TD>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
