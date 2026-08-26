import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { getAccessCardReport } from '@/lib/reporting/queries';
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

export default async function AccessCardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const cards = await getAccessCardReport();

  const lost = cards.filter((card) => card.status === 'lost');

  return (
    <>
      <PageHeader title={t('cards.title')} description={t('cards.subtitle')} />

      <div className="mb-4">
        <ComingSoon>
          {t('cardAction.activate')} / {t('cardAction.disable')} / {t('cardAction.report_lost')} /{' '}
          {t('cardAction.replace')} / {t('cardAction.return')} — {t('common.loading')}
        </ComingSoon>
      </div>

      <Card>
        <CardHeader
          title={t('reports.cardStatus')}
          description={`${cards.length} ${t('cards.title')} · ${lost.length} ${t('cardStatus.lost')}`}
        />
        <Table
          head={
            <tr>
              <TH>{t('room.roomNumber')}</TH>
              <TH>{t('cards.cardNumber')}</TH>
              <TH>{t('cards.cardUid')}</TH>
              <TH>{t('common.status')}</TH>
              <TH>{t('cards.issuedDate')}</TH>
              <TH>{t('cards.returnedDate')}</TH>
              <TH numeric>{t('cards.replacementFee')}</TH>
            </tr>
          }
        >
          {cards.map((card) => (
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
              <TD>{formatDate(card.issued_date, typedLocale)}</TD>
              <TD>{formatDate(card.returned_date, typedLocale)}</TD>
              <TD numeric>
                {card.replacement_fee > 0 ? formatTHB(card.replacement_fee, typedLocale) : '-'}
              </TD>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
