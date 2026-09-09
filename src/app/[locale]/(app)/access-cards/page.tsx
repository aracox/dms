import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AccessCardsTable } from '@/components/access-cards/AccessCardsTable';
import { SegmentSwitcher } from '@/components/dashboard/SegmentSwitcher';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import type { Locale } from '@/i18n/routing';
import { can } from '@/lib/permissions';
import { getAccessCardReport } from '@/lib/reporting/queries';
import { PROPERTY_SEGMENTS, filterByView, parseSegmentView } from '@/lib/reporting/segments';
import { getSettingsBySegment } from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import type { PropertySegment } from '@/types/database';

export default async function AccessCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const typedLocale = locale as Locale;
  const view = parseSegmentView((await searchParams).segment);

  const [allCards, profile, settingsBySegment] = await Promise.all([
    getAccessCardReport(),
    getCurrentProfile(),
    // Both segments: this table mixes หอพัก and บ้านพัก rows, and each one's
    // replacement fee is its own since migration 0025.
    getSettingsBySegment(),
  ]);

  // report_access_cards carries property_segment, so both the table and the
  // card counts in the header follow the filter.
  const cards = filterByView(view, allCards);

  const canWrite = can(profile?.role, 'cards:write');
  const replacementFeeBySegment = Object.fromEntries(
    PROPERTY_SEGMENTS.map((segment) => [segment, settingsBySegment[segment].card_replacement_fee]),
  ) as Record<PropertySegment, number>;

  const lost = cards.filter((card) => card.status === 'lost');

  return (
    <>
      <PageHeader
        title={t('cards.title')}
        description={t('cards.subtitle')}
        action={<SegmentSwitcher current={view} pathname="/access-cards" />}
      />

      <Card>
        <CardHeader
          title={t('reports.cardStatus')}
          description={`${cards.length} ${t('cards.title')} · ${lost.length} ${t('cardStatus.lost')}`}
        />
        <AccessCardsTable
          cards={cards}
          canWrite={canWrite}
          replacementFeeBySegment={replacementFeeBySegment}
          locale={typedLocale}
        />
      </Card>
    </>
  );
}
