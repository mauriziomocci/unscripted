import type { Scheduler } from '../time/ports';
import { LlmError } from './errors';
import type { LlmAbortSignal } from './request';

const ABORTED_MESSAGE = 'the call was aborted while it waited';

/**
 * Resolves after `ms` on the injected scheduler, so a test chooses when the
 * wait ends. An abort ends the wait at once with `LlmError('timeout')` and
 * cancels the timer: a call that was given up on must not sleep through its
 * backoff.
 */
export function pause(scheduler: Scheduler, ms: number, signal?: LlmAbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new LlmError('timeout', ABORTED_MESSAGE));
      return;
    }
    const onAbort = (): void => {
      scheduler.clearTimeout(timer);
      reject(new LlmError('timeout', ABORTED_MESSAGE));
    };
    const timer = scheduler.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
