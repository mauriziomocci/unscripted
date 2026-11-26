import type { Scheduler } from '../time/ports';
import { BACKOFF_SCHEDULES } from './backoff';
import type { LlmClient, LlmRequest } from './request';
import { callWithRetries } from './retry';

/** The retry rules of the shared queue: the Venture's schedule, which the novel will share (`llm.js:39-55`). */
const SHARED_QUEUE_SCHEDULE = BACKOFF_SCHEDULES.venture;

/** The request resent after Haiku was refused: the same call, on the main model with low latency (P-01a). */
function withoutHaiku(request: LlmRequest): LlmRequest {
  return { ...request, tier: 'main', lowLatency: true };
}

/**
 * The model fallback of the shared queue (P-01a, shared-queue variant,
 * `llm.js:42-53`) as a decorator over any `LlmClient`: a refusal of Haiku
 * switches it off for the session and resends the same call as `main` with
 * `lowLatency`; any other refusal and every error but a rate limit end the
 * call; a rate limit retries by the one rule of S-08.
 *
 * The legacy decides a refusal's cause by asking again which model it would
 * send now (`llm.js:48`), so two concurrent refusals of Haiku threw the second
 * one. Here the cause is the model the failed call actually used, and a
 * second refusal of Haiku resends too (AM2-05).
 */
export function withSharedQueue(inner: LlmClient, scheduler: Scheduler): LlmClient {
  let haikuAvailable = true;
  return {
    complete(request) {
      let sentToHaiku = false;
      return callWithRetries(
        (attempt) => {
          sentToHaiku = request.tier === 'light' && haikuAvailable;
          const sent =
            request.tier === 'light' && !haikuAvailable ? withoutHaiku(request) : request;
          return inner.complete({ ...sent, attempt });
        },
        {
          schedule: SHARED_QUEUE_SCHEDULE,
          scheduler,
          ...(request.signal ? { signal: request.signal } : {}),
          startAttempt: request.attempt ?? 0,
          recoversAtOnce: (error) => {
            const refusedHaiku = error.code === 'model_refused' && sentToHaiku;
            if (refusedHaiku) haikuAvailable = false;
            return refusedHaiku;
          },
        },
      );
    },
  };
}
