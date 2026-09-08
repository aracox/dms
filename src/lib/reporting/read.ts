/**
 * How a reporting read reports failure.
 *
 * Deliberately separate from `queries.ts`, which imports `server-only` and so
 * cannot be imported by a test. The rules here decide whether the owner sees a
 * number, an error, or a retry, so they are worth pinning down -- see
 * `read.test.ts`.
 */

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * A broken reporting read must never look like a real zero.
 *
 * The query functions used to discard `error` and fall back to an empty value,
 * so an unapplied migration reached the dashboard as "24 units -- 0 dorm rooms
 * and 0 houses" instead of as a failure. Throw, and let the error boundary say
 * so. The empty constants in `queries.ts` are for a view that legitimately
 * returned no row, such as a segment with no rooms yet.
 */
export function reportingError(view: string, error: PostgrestError): Error {
  return new Error(
    `reporting: query on ${view} failed -- ${error.message}` +
      (error.hint ? ` (hint: ${error.hint})` : ''),
    { cause: error },
  );
}

/**
 * Token errors that clear themselves, and so must not take a page down.
 *
 * PostgREST checks the access token's `iat` against its own clock, but GoTrue
 * minted that token from a different Supabase service's clock. A second of skew
 * between the two is enough to be told the token was "issued at future", and
 * the next request succeeds.
 *
 * Nothing structural belongs in here. A missing view, a denied grant or a
 * dropped column is not going to fix itself, and retrying it only delays the
 * error the owner needs to see.
 */
export const SELF_CLEARING_TOKEN_ERROR = /issued at future|not yet valid/i;

/**
 * Long enough for the skew that caused the rejection to pass. Retrying
 * immediately would just be told the same thing, since the clock has not
 * moved. Only ever paid on the error path, and only once.
 */
export const RETRY_DELAY_MS = 1_000;

export type QueryResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Runs one reporting query, retrying a single time if the token was rejected
 * for clock skew. Anything else throws immediately, with the view named.
 *
 * `run` rebuilds the query rather than taking a built one, because a retry
 * needs a fresh request.
 */
export async function read<T>(
  view: string,
  run: () => PromiseLike<QueryResult<T>>,
  delayMs: number = RETRY_DELAY_MS,
): Promise<T | null> {
  const first = await run();
  if (!first.error) return first.data;
  if (!SELF_CLEARING_TOKEN_ERROR.test(first.error.message)) {
    throw reportingError(view, first.error);
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const retry = await run();
  if (retry.error) throw reportingError(view, retry.error);
  return retry.data;
}
