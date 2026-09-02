import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AccessCardsTable } from '@/components/access-cards/AccessCardsTable';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { can } from '@/lib/permissions';
import { getAccessCardReport } from '@/lib/reporting/queries';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';

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
        <AccessCardsTable
          cards={cards}
          canWrite={canWrite}
          defaultReplacementFee={defaultReplacementFee}
          locale={typedLocale}
        />
      </Card>
    </>
  );
}
