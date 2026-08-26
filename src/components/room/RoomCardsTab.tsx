import { useTranslations } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, Field, FieldGrid } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { RoomDetail } from '@/lib/rooms/queries';
import { formatDate } from '@/lib/utils/date';
import type { CardStatus } from '@/types/database';

const CARD_TONE: Record<CardStatus, BadgeTone> = {
  available: 'neutral',
  active: 'green',
  lost: 'red',
  disabled: 'neutral',
  damaged: 'yellow',
  returned: 'blue',
};

/** Two cards per room, belonging to the room rather than to any occupant. */
export function RoomCardsTab({ detail, locale }: { detail: RoomDetail; locale: Locale }) {
  const t = useTranslations();

  if (detail.cards.length === 0) {
    return <EmptyState message={t('room.noCards')} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {detail.cards.map((card, index) => (
          <Card key={card.id}>
            <CardHeader
              title={card.card_number}
              description={index === 0 ? t('cards.slotA') : t('cards.slotB')}
              action={<Badge tone={CARD_TONE[card.status]}>{t(`cardStatus.${card.status}`)}</Badge>}
            />
            <CardBody>
              <FieldGrid className="sm:grid-cols-2 lg:grid-cols-2">
                <Field
                  label={t('cards.cardUid')}
                  value={card.card_uid ?? t('common.notAvailable')}
                />
                <Field label={t('cards.issuedDate')} value={formatDate(card.issued_date, locale)} />
                <Field
                  label={t('cards.returnedDate')}
                  value={formatDate(card.returned_date, locale)}
                />
                <Field
                  label={t('cards.replacementFee')}
                  value={formatTHB(card.replacement_fee, locale)}
                />
              </FieldGrid>
              {card.notes ? <p className="text-ink-subtle mt-1 text-xs">{card.notes}</p> : null}
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-ink-subtle text-xs">{t('cards.belongsToRoom')}</p>

      {detail.cardEvents.length > 0 ? (
        <Card>
          <CardHeader title={t('cards.history')} />
          <Table
            head={
              <tr>
                <TH>{t('common.date')}</TH>
                <TH>{t('cards.cardNumber')}</TH>
                <TH>{t('common.actions')}</TH>
                <TH>{t('common.status')}</TH>
                <TH numeric>{t('cards.replacementFee')}</TH>
                <TH>{t('common.note')}</TH>
              </tr>
            }
          >
            {detail.cardEvents.map((event) => {
              const card = detail.cards.find((candidate) => candidate.id === event.card_id);

              return (
                <tr key={event.id}>
                  <TD>{formatDate(event.created_at.slice(0, 10), locale)}</TD>
                  <TD>{card?.card_number ?? t('common.notAvailable')}</TD>
                  <TD>{t(`cardAction.${event.action}`)}</TD>
                  <TD>
                    <span className="text-ink-muted text-xs">
                      {event.from_status ? `${t(`cardStatus.${event.from_status}`)} → ` : ''}
                    </span>
                    {t(`cardStatus.${event.to_status}`)}
                  </TD>
                  <TD numeric>{event.fee > 0 ? formatTHB(event.fee, locale) : '-'}</TD>
                  <TD>{event.note ?? '-'}</TD>
                </tr>
              );
            })}
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
