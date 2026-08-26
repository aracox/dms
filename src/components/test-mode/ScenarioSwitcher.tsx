'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { TEST_SCENARIO_IDS, type TestScenarioId } from '@/config/test-scenarios';
import {
  applyTestScenarioAction,
  resetTestDataAction,
  INITIAL_TEST_MODE_STATE,
} from '@/lib/test-mode/actions';
import { cn } from '@/lib/utils/cn';

export function ScenarioSwitcher({ currentScenario }: { currentScenario: TestScenarioId | null }) {
  const t = useTranslations();
  const [applyState, applyAction, isApplying] = useActionState(
    applyTestScenarioAction,
    INITIAL_TEST_MODE_STATE,
  );
  const [resetState, resetAction, isResetting] = useActionState(
    resetTestDataAction,
    INITIAL_TEST_MODE_STATE,
  );

  const feedback = applyState.error || resetState.error || applyState.message || resetState.message;
  const isError = Boolean(applyState.error || resetState.error);
  // Server-side failures come back as raw messages; successes come back as keys.
  const feedbackText = feedback && !isError ? t(feedback) : feedback;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TEST_SCENARIO_IDS.map((scenario) => (
          <form key={scenario} action={applyAction}>
            <input type="hidden" name="scenario" value={scenario} />
            <button
              type="submit"
              disabled={isApplying || isResetting}
              title={t(`testMode.scenarioDescriptions.${scenario}`)}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60',
                currentScenario === scenario
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-border bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {t(`testMode.scenarios.${scenario}`)}
            </button>
          </form>
        ))}

        <form action={resetAction} className="ml-auto">
          <button
            type="submit"
            disabled={isApplying || isResetting}
            className="border-brand-red text-brand-red-deep hover:bg-brand-red-soft flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            <RotateCcw size={12} aria-hidden="true" />
            {t('testMode.reset')}
          </button>
        </form>
      </div>

      {feedbackText ? (
        <p
          role="status"
          className={cn(
            'rounded border px-2.5 py-1.5 text-xs',
            isError
              ? 'border-brand-red bg-brand-red-soft text-brand-red-deep'
              : 'border-brand-green bg-brand-green-soft text-brand-green-deep',
          )}
        >
          {feedbackText}
        </p>
      ) : null}
    </div>
  );
}
