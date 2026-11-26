import type { Scheduler } from '../time/ports';
import { pause } from '../time/pause';
import { BACKOFF_SCHEDULES, backoffWaitMs, mayRetry } from './backoff';
import { LlmError } from './errors';
import type { LlmClient, LlmRequest, LlmResult } from './request';

/** The retry rules of the shared queue: the Venture's schedule, which the novel will share (`llm.js:39-55`). */
const SHARED_QUEUE_SCHEDULE = BACKOFF_SCHEDULES.venture;

/** The request resent after Haiku was refused: the same call, on the main model with low latency (P-01a). */
function resentWithoutHaiku(request: LlmRequest, attempt: number): LlmRequest {
  return { ...request, tier: 'main', lowLatency: true, attempt };
}

/**
 * The model fallback and the retries of the shared queue (P-01a, shared-queue
 * variant, `llm.js:42-53`), as a decorator over any `LlmClient`: the client
 * only classifies errors, this decides. One refusal of Haiku switches it off
 * for the session and resends the same call as `main` with `lowLatency`; a
 * refusal of any other model, and every other error but a rate limit, ends
 * the call. A rate limit waits the reported time, or the Venture schedule's
 * step, and retries at most four times, a refusal resend counting as one.
 *
 * The legacy decides a refusal's cause by asking again which model it would
 * send now (`llm.js:48`), so two concurrent refusals of Haiku threw the second
 * one. Here the cause is the model the failed call actually used, and a
 * second refusal of Haiku resends too (AM2-05).
 */
export function withSharedQueue(inner: LlmClient, scheduler: Scheduler): LlmClient {
  let haikuAvailable = true;

  async function attemptCall(request: LlmRequest, attempt: number): Promise<LlmResult> {
    const sentToHaiku = request.tier === 'light' && haikuAvailable;
    const sent =
      request.tier === 'light' && !haikuAvailable
        ? resentWithoutHaiku(request, attempt)
        : { ...request, attempt };
    try {
      return await inner.complete(sent);
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      return recover(request, error, attempt, sentToHaiku);
    }
  }

  async function recover(
    request: LlmRequest,
    error: LlmError,
    attempt: number,
    sentToHaiku: boolean,
  ): Promise<LlmResult> {
    if (error.code === 'model_refused' && sentToHaiku) {
      haikuAvailable = false;
      return attemptCall(request, attempt + 1);
    }
    if (error.code !== 'rate_limited' || !mayRetry(SHARED_QUEUE_SCHEDULE, attempt)) throw error;
    await pause(scheduler, error.retryAfterMs ?? backoffWaitMs(SHARED_QUEUE_SCHEDULE, attempt + 1));
    return attemptCall(request, attempt + 1);
  }

  return { complete: (request) => attemptCall(request, request.attempt ?? 0) };
}
