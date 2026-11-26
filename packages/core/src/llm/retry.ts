import type { Scheduler } from '../time/ports';
import { type BackoffSchedule, backoffWaitMs, mayRetry } from './backoff';
import { LlmError } from './errors';
import { pause } from './pause';
import type { LlmAbortSignal } from './request';

export interface RetryOptions {
  readonly schedule: BackoffSchedule;
  readonly scheduler: Scheduler;
  readonly signal?: LlmAbortSignal;
  /** The attempt number of the first try (0 unless the request already carries one). */
  readonly startAttempt?: number;
  /**
   * An error the caller can mend by sending again with no wait (the shared
   * queue's refusal of Haiku). The resend takes one of the retries, as in the
   * legacy (`llm.js:51`). May record what it learnt.
   */
  readonly recoversAtOnce?: (error: LlmError) => boolean;
  /** Replaces the plain pause, for a caller that turns the wait into a cooldown shared by several calls. */
  readonly wait?: (ms: number) => Promise<void>;
}

/** The wait before the next try, or the error itself when it is not a rate limit or the schedule has no retry left. */
function waitBeforeRetry(error: LlmError, schedule: BackoffSchedule, attempt: number): number {
  if (error.code !== 'rate_limited' || !mayRetry(schedule, attempt)) throw error;
  return error.retryAfterMs ?? backoffWaitMs(schedule, attempt + 1);
}

/**
 * The one retry rule of S-08 (FR-028, FR-053): a rate limit is retried after
 * the wait the server reported, or the schedule's own step when it reported
 * none, and `mayRetry` decides when to stop. Every other error reaches the
 * caller. Core alone counts attempts: `run` receives the attempt number.
 */
export async function callWithRetries<T>(
  run: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { schedule, scheduler, signal } = options;
  const wait = options.wait ?? ((ms: number) => pause(scheduler, ms, signal));
  for (let attempt = options.startAttempt ?? 0; ; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      if (options.recoversAtOnce?.(error) === true) continue;
      await wait(waitBeforeRetry(error, schedule, attempt));
    }
  }
}
