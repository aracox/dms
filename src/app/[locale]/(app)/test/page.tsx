import { FlaskConical, Info } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { RoomDetail } from '@/components/room/RoomDetail';
import { RoomStatusBadge } from '@/components/status/RoomStatusBadge';
import { ScenarioSwitcher } from '@/components/test-mode/ScenarioSwitcher';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { T01_ROOM_NUMBER } from '@/config/test-scenarios';
import type { Locale } from '@/i18n/routing';
import { getRoomBoardByNumber, getRoomDetail } from '@/lib/rooms/queries';
import { inferTestScenario } from '@/lib/test-mode/infer';
import { bangkokToday } from '@/lib/utils/date';

/**
 * Test Mode.
 *
 * Renders T01 through the SAME `RoomDetail` component as any real room. There is
 * no mock implementation of a room anywhere in the codebase -- if this page ever
 * needs different behaviour, parameterise RoomDetail instead of forking it.
 */
export default async function TestModePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const today = bangkokToday();

  const board = await getRoomBoardByNumber(T01_ROOM_NUMBER);
  const detail = board ? await getRoomDetail(board.room_id) : null;
  const scenario = inferTestScenario(board, today);

  return (
    <>
      <PageHeader
        title={t('testMode.title')}
        description={t('testMode.subtitle')}
        action={
          board ? (
            <div className="flex items-center gap-2">
              <Badge tone="yellow" icon={<FlaskConical size={11} aria-hidden="true" />}>
                {board.room_number}
              </Badge>
              <RoomStatusBadge
                roomStatus={board.room_status}
                financialStatus={board.financial_status}
              />
            </div>
          ) : null
        }
      />

      <div className="border-brand-yellow bg-brand-yellow-soft text-brand-yellow-deep mb-4 flex gap-2 rounded-md border px-3 py-2 text-xs">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t('testMode.banner')}</p>
          <p className="mt-0.5">{t('testMode.notOnFloorPlan')}</p>
          <p className="mt-0.5">{t('testMode.sameComponents')}</p>
        </div>
      </div>

      <section className="border-border bg-surface mb-5 rounded-lg border p-3">
        <h2 className="text-ink mb-2 text-sm font-semibold">
          {t('testMode.scenario')}
          {scenario ? (
            <span className="text-ink-muted ml-2 text-xs font-normal">
              {t('testMode.currentScenario')}: {t(`testMode.scenarios.${scenario}`)}
            </span>
          ) : null}
        </h2>
        <ScenarioSwitcher currentScenario={scenario} />
        {scenario ? (
          <p className="text-ink-subtle mt-2 text-xs">
            {t(`testMode.scenarioDescriptions.${scenario}`)}
          </p>
        ) : null}
      </section>

      {detail ? (
        <RoomDetail detail={detail} locale={locale as Locale} today={today} />
      ) : (
        <EmptyState message={`${t('errors.roomNotFound')} (${T01_ROOM_NUMBER}) — npm run seed`} />
      )}
    </>
  );
}
