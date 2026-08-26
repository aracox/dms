'use server';

import { revalidatePath } from 'next/cache';

import { isTestScenarioId } from '@/config/test-scenarios';
import { assertCan } from '@/lib/permissions';
import { getCurrentProfile } from '@/lib/supabase/server';

import { reconcileTestRoom, resetTestRoom, TestModeError } from './reconcile';

export interface TestModeState {
  message: string | null;
  error: string | null;
}

export const INITIAL_TEST_MODE_STATE: TestModeState = { message: null, error: null };

async function requireTestModeAccess() {
  const profile = await getCurrentProfile();
  // Throws PermissionError, which the error boundary renders.
  assertCan(profile?.role, 'test-mode:use');
}

export async function applyTestScenarioAction(
  _previous: TestModeState,
  formData: FormData,
): Promise<TestModeState> {
  await requireTestModeAccess();

  const scenario = formData.get('scenario');
  if (!isTestScenarioId(scenario)) return { message: null, error: 'errors.generic' };

  try {
    await reconcileTestRoom(scenario);
  } catch (error) {
    if (error instanceof TestModeError) return { message: null, error: error.message };
    throw error;
  }

  revalidatePath('/', 'layout');
  return { message: 'testMode.applyScenario', error: null };
}

export async function resetTestDataAction(
  _previous: TestModeState,
  _formData: FormData,
): Promise<TestModeState> {
  await requireTestModeAccess();

  try {
    await resetTestRoom();
  } catch (error) {
    if (error instanceof TestModeError) return { message: null, error: error.message };
    throw error;
  }

  revalidatePath('/', 'layout');
  return { message: 'testMode.resetDone', error: null };
}
