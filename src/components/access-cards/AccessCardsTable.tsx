'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { CardActions } from '@/components/room/CardActions';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { AccessCardReportRow, CardStatus } from '@/types/database';
import { formatDate } from '@/lib/utils/date';

const STATUSES: CardStatus[] = ['available', 'active', 'lost', 'disabled', 'damaged', 'returned'];

const CARD_TONE: Record<CardStatus, BadgeTone> = {
  available: 'neutral',
  active: 'green',
  lost: 'red',
  disabled: 'neutral',
  damaged: 'yellow',
  returned: 'blue',
};

export function AccessCardsTable({
  cards,
  canWrite,
  defaultReplacementFee,
  locale,
}: {
  cards: AccessCardReportRow[];
  canWrite: boolean;
  defaultReplacementFee: number;
  locale: Locale;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState<string>('all');
  const [status, setStatus] = useState<CardStatus | 'all'>('all');

  const rooms = useMemo(
    () => Array.from(new Set(cards.map((card) => card.room_number))).sort(),
    [cards],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return cards.filter((card) => {
      if (room !== 'all' && card.room_number !== room) return false;
      if (status !== 'all' && card.status !== status) return false;
      if (!needle) return true;
      return (
        card.room_number.toLowerCase().includes(needle) ||
        card.card_number.toLowerCase().includes(needle) ||
        (card.card_uid ?? '').toLowerCase().includes(needle)
      );
    });
  }, [cards, query, room, status]);

  const selectClass = 'rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="card-search" className="text-ink-muted block text-xs font-medium">
            {t('common.search')}
          </label>
          <div className="relative mt-1">
            <Search
              size={14}
              className="text-ink-subtle absolute top-1/2 left-2.5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="card-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('cards.searchPlaceholder')}
              className="border-border bg-surface text-ink w-full rounded-md border py-1.5 pr-3 pl-8 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="card-room" className="text-ink-muted block text-xs font-medium">
            {t('cards.filterByRoom')}
          </label>
          <select
            id="card-room"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            className={`mt-1 ${selectClass}`}
          >
            <option value="all">{t('cards.allRooms')}</option>
            {rooms.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="card-status" className="text-ink-muted block text-xs font-medium">
            {t('cards.filterByStatus')}
          </label>
          <select
            id="card-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as CardStatus | 'all')}
            className={`mt-1 ${selectClass}`}
          >
            <option value="all">{t('cards.allStatuses')}</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`cardStatus.${candidate}`)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-ink-subtle ml-auto text-xs" aria-live="polite">
          {t('cards.resultCount', { count: filtered.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={t('cards.noResults')} />
      ) : (
        <Table
          head={
            <tr>
              <TH>{t('room.roomNumber')}</TH>
              <TH>{t('cards.cardNumber')}</TH>
              <TH>{t('cards.cardUid')}</TH>
              <TH>{t('common.status')}</TH>
              <TH>{t('cards.issuedDate')}</TH>
              <TH>{t('cards.returnedDate')}</TH>
              {canWrite ? <TH>{t('common.actions')}</TH> : null}
              {canWrite ? <TH>{t('common.save')}</TH> : null}
            </tr>
          }
        >
          {filtered.map((card) => (
            <tr key={card.card_id}>
              <TD>
                <Link
                  href={`/rooms/${card.room_id}`}
                  className="text-brand-blue-deep font-medium underline"
                >
                  {card.room_number}
                </Link>
              </TD>
              <TD>{card.card_number}</TD>
              <TD className="text-ink-muted text-xs">{card.card_uid ?? '-'}</TD>
              <TD>
                <Badge tone={CARD_TONE[card.status]}>{t(`cardStatus.${card.status}`)}</Badge>
              </TD>
              <TD>{formatDate(card.issued_date, locale)}</TD>
              <TD>{formatDate(card.returned_date, locale)}</TD>
              {canWrite ? (
                <CardActions
                  roomId={card.room_id}
                  card={{ id: card.card_id, status: card.status }}
                  defaultReplacementFee={defaultReplacementFee}
                  asTableCells
                />
              ) : null}
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
