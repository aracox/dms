/**
 * How a reporting read fails.
 *
 * The point of `read` is that a broken query can never reach the owner as a
 * zero. The retry is a narrow exception for one self-clearing token error, and
 * the risk is that it widens over time until a real fault -- an unapplied
 * migration, a revoked grant -- gets retried and then swallowed. These tests
 * pin the line.
 */

import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { SELF_CLEARING_TOKEN_ERROR, read, reportingError } from './read';

const pgError = (message: string, hint?: string): PostgrestError =>
  ({ message, hint: hint ?? null, details: null, code: '42501' }) as unknown as PostgrestError;

/** A query that yields the given results in order, one per call. */
function queryReturning<T>(...results: { data: T | null; error: PostgrestError | null }[]) {
  const run = vi.fn(() =>
    Promise.resolve(results[Math.min(run.mock.calls.length - 1, results.length - 1)]!),
  );
  return run;
}

describe('read', () => {
  it('returns the data and calls the query once when it succeeds', async () => {
    const run = queryReturning({ data: { total_rooms: 24 }, error: null });

    await expect(read('report_room_summary', run, 0)).resolves.toEqual({ total_rooms: 24 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('passes a legitimate empty result through rather than treating it as failure', async () => {
    // A segment with no rooms yet: no error, no row. The caller substitutes its
    // own empty constant.
    const run = queryReturning({ data: null, error: null });

    await expect(read('report_room_summary_by_segment', run, 0)).resolves.toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('throws on a missing view without retrying it', async () => {
    // The failure that started all this: migration 0024 unapplied.
    const run = queryReturning({
      data: null,
      error: pgError(
        "Could not find the table 'public.report_room_summary_by_segment' in the schema cache",
        'Perhaps you meant the table public.report_room_summary',
      ),
    });

    await expect(read('report_room_summary_by_segment', run, 0)).rejects.toThrow(
      /report_room_summary_by_segment failed -- Could not find the table/,
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('throws on a denied grant without retrying it', async () => {
    const run = queryReturning({
      data: null,
      error: pgError('permission denied for view report_rooms'),
    });

    await expect(read('report_rooms', run, 0)).rejects.toThrow(/permission denied/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retries a future-dated token once and returns the second result', async () => {
    const run = queryReturning(
      { data: null, error: pgError('JWT issued at future') },
      { data: { total_rooms: 24 }, error: null },
    );

    await expect(read('report_room_summary', run, 0)).resolves.toEqual({ total_rooms: 24 });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry rather than looping', async () => {
    const run = queryReturning({ data: null, error: pgError('JWT issued at future') });

    await expect(read('report_room_summary', run, 0)).rejects.toThrow(/JWT issued at future/);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('waits before retrying, since the clock has not moved yet', async () => {
    vi.useFakeTimers();
    try {
      const run = queryReturning(
        { data: null, error: pgError('JWT issued at future') },
        { data: { total_rooms: 24 }, error: null },
      );

      const pending = read('report_room_summary', run, 1_000);
      await vi.advanceTimersByTimeAsync(999);
      expect(run).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ total_rooms: 24 });
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SELF_CLEARING_TOKEN_ERROR', () => {
  it('matches the clock-skew rejections that fix themselves', () => {
    expect(SELF_CLEARING_TOKEN_ERROR.test('JWT issued at future')).toBe(true);
    expect(SELF_CLEARING_TOKEN_ERROR.test('token is not yet valid')).toBe(true);
  });

  it('matches nothing structural, which must reach the owner as an error', () => {
    for (const message of [
      "Could not find the table 'public.report_room_summary_by_segment' in the schema cache",
      'permission denied for view report_rooms',
      'column report_rooms.property_segment does not exist',
      'JWT expired',
      'invalid JWT: unable to parse or verify signature',
      'relation "report_rooms" does not exist',
    ]) {
      expect(SELF_CLEARING_TOKEN_ERROR.test(message), message).toBe(false);
    }
  });
});

describe('reportingError', () => {
  it('names the view, so the log says which query broke', () => {
    const error = reportingError('report_finance_summary', pgError('boom'));
    expect(error.message).toBe('reporting: query on report_finance_summary failed -- boom');
  });

  it('includes the hint when PostgREST supplies one', () => {
    const error = reportingError('report_rooms', pgError('boom', 'try that instead'));
    expect(error.message).toContain('(hint: try that instead)');
  });

  it('keeps the original error as the cause', () => {
    const cause = pgError('boom');
    expect(reportingError('report_rooms', cause).cause).toBe(cause);
  });
});
