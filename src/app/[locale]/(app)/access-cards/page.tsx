import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { CardActions } from '@/components/room/CardActions';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { can } from '@/lib/permissions';
import { getAccessCardReport } from '@/lib/reporting/queries';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
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
  const supabase = await createClient();

  const [cards, profile, cardReplacementFeeSetting] = await Promise.all([
    getAccessCardReport(),
    getCurrentProfile(),
    supabase.from('settings').select('value').eq('key', 'card_replacement_fee').maybeSingle(),
  ]);

  const canWrite = can(profile?.role, 'cards:write');
  const defaultReplacementFee =
    typeof cardReplacementFeeSetting.data?.value === 'number'
      ? cardReplacementFeeSetting.data.value
      : 0;

  const lost = cards.filter((card) => card.status === 'lost');

  return (
    <>
      <PageHeader title={t('cards.title')} description={t('cards.subtitle')} />

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
              {canWrite ? <TH>{t('common.actions')}</TH> : null}
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
              {canWrite ? (
                <TD>
                  <CardActions
                    roomId={card.room_id}
                    card={{ id: card.card_id, status: card.status }}
                    defaultReplacementFee={defaultReplacementFee}
                  />
                </TD>
              ) : null}
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
