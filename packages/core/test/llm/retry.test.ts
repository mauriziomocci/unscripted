import { describe, expect, it } from 'vitest';
import { LlmError } from '../../src/llm/errors';
import { BACKOFF_SCHEDULES } from '../../src/llm/backoff';
import { callWithRetries } from '../../src/llm/retry';
import { instantScheduler } from '../support/instantScheduler';
import { fakeClock, manualScheduler } from '../support/manualTime';

const SCHEDULE = BACKOFF_SCHEDULES.archiveGenerate;
const rateLimited = (retryAfterMs?: number) =>
  new LlmError('rate_limited', 'slow', retryAfterMs === undefined ? {} : { retryAfterMs });

/** A call that fails with the given errors in order, then answers «fatto». */
function failing(errors: readonly Error[]) {
  const attempts: number[] = [];
  const run = (attempt: number): Promise<string> => {
    attempts.push(attempt);
    const error = errors[attempts.length - 1];
    return error === undefined ? Promise.resolve('fatto') : Promise.reject(error);
  };
  return { run, attempts };
}

describe('callWithRetries, the one rule of S-08', () => {
  it('waits the reported time when there is one, else the schedule step', async () => {
    const { run, attempts } = failing([rateLimited(), rateLimited(1234), rateLimited()]);
    const { scheduler, waits } = instantScheduler();
    await expect(callWithRetries(run, { schedule: SCHEDULE, scheduler })).resolves.toBe('fatto');
    expect(waits).toEqual([15_000, 1234, 60_000]);
    expect(attempts).toEqual([0, 1, 2, 3]);
  });

  it('gives up when the schedule has no retry left', async () => {
    const { run, attempts } = failing(Array.from({ length: 4 }, () => rateLimited()));
    const { scheduler } = instantScheduler();
    await expect(callWithRetries(run, { schedule: SCHEDULE, scheduler })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(attempts).toHaveLength(4);
  });

  it('starts counting from the attempt it is given', async () => {
    const { run, attempts } = failing([rateLimited()]);
    const { scheduler, waits } = instantScheduler();
    await callWithRetries(run, { schedule: SCHEDULE, scheduler, startAttempt: 2 });
    expect(attempts).toEqual([2, 3]);
    expect(waits).toEqual([60_000]);
  });
});

describe('callWithRetries, other errors and hooks', () => {
  it.each([new LlmError('denied', 'no'), new Error('boom')])(
    'rethrows %s at once',
    async (error) => {
      const { run, attempts } = failing([error]);
      const { scheduler } = instantScheduler();
      await expect(callWithRetries(run, { schedule: SCHEDULE, scheduler })).rejects.toBe(error);
      expect(attempts).toHaveLength(1);
    },
  );

  it('resends at once, with no wait, an error the caller says to', async () => {
    const refused = new LlmError('model_refused', 'no');
    const { run, attempts } = failing([refused]);
    const { scheduler, waits } = instantScheduler();
    const options = {
      schedule: SCHEDULE,
      scheduler,
      recoversAtOnce: (e: LlmError) => e === refused,
    };
    await callWithRetries(run, options);
    expect(waits).toEqual([]);
    expect(attempts).toEqual([0, 1]);
  });

  it('lets the caller turn the wait into something else', async () => {
    const { run } = failing([rateLimited()]);
    const { scheduler } = instantScheduler();
    const seen: number[] = [];
    const wait = (ms: number) => {
      seen.push(ms);
      return Promise.resolve();
    };
    await callWithRetries(run, { schedule: SCHEDULE, scheduler, wait });
    expect(seen).toEqual([15_000]);
  });
});

describe('callWithRetries and the abort signal', () => {
  it('ends a wait with a timeout error when the signal fires, and clears the timer', async () => {
    const clock = fakeClock();
    const time = manualScheduler(clock);
    const controller = new AbortController();
    const { run } = failing([rateLimited()]);
    const call = callWithRetries(run, {
      schedule: SCHEDULE,
      scheduler: time.scheduler,
      signal: controller.signal,
    });
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(call).rejects.toMatchObject({ code: 'timeout' });
    expect(time.cleared).toHaveLength(1);
  });

  it('does not wait at all when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { run } = failing([rateLimited()]);
    const { scheduler, waits } = instantScheduler();
    await expect(
      callWithRetries(run, { schedule: SCHEDULE, scheduler, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'timeout' });
    expect(waits).toEqual([]);
  });
});
