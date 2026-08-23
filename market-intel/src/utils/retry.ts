import { CollectionError, toCollectionError } from './errors.js';
import type { Logger } from './logger.js';

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface RetryHooks {
  /** Called after every failed attempt, before the sleep. */
  onAttemptFailed?: (err: CollectionError, attempt: number) => Promise<void> | void;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function backoffFor(policy: RetryPolicy, attempt: number): number {
  const raw = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  const capped = Math.min(raw, policy.maxBackoffMs);
  // full jitter, so parallel workers do not retry in lockstep
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

/**
 * Runs `fn` with exponential backoff. Non-retryable CollectionErrors abort
 * immediately — retrying a config error or a "we are not allowed here" response
 * is just extra load on someone else's server.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  log: Logger,
  hooks: RetryHooks = {},
): Promise<T> {
  let lastError: CollectionError | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const error = toCollectionError(err);
      lastError = error;
      await hooks.onAttemptFailed?.(error, attempt);

      if (!error.retryable) {
        log.warn({ attempt, stage: error.stage, err: error.message }, 'non-retryable failure, giving up');
        throw error;
      }
      if (attempt >= policy.maxAttempts) break;

      const delay = backoffFor(policy, attempt);
      log.warn({ attempt, stage: error.stage, err: error.message, retryInMs: delay }, 'attempt failed, retrying');
      await sleep(delay);
    }
  }

  throw lastError ?? new CollectionError({ stage: 'unknown', message: 'retry loop exited without result' });
}
