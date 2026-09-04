'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { CardActions } from '@/components/room/CardActions';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input, Select } from '@/components/ui/Input';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <FormField label={t('common.search')} htmlFor="card-search" className="min-w-56 flex-1">
          <div className="relative">
            <Search
              size={14}
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="card-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('cards.searchPlaceholder')}
              className="pl-9"
            />
          </div>
        </FormField>

        <FormField label={t('cards.filterByRoom')} htmlFor="card-room">
          <Select
            id="card-room"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            className="w-auto"
          >
            <option value="all">{t('cards.allRooms')}</option>
            {rooms.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('cards.filterByStatus')} htmlFor="card-status">
          <Select
            id="card-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as CardStatus | 'all')}
            className="w-auto"
          >
            <option value="all">{t('cards.allStatuses')}</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`cardStatus.${candidate}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <p className="text-ink-subtle text-caption ml-auto" aria-live="polite">
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
              <TD className="text-ink-muted text-caption font-mono">{card.card_uid ?? '-'}</TD>
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
                  locale={locale}
                  asTableCell
                />
              ) : null}
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
