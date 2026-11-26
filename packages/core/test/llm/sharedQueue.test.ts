import { describe, expect, it } from 'vitest';
import { LlmError } from '../../src/llm/errors';
import type { LlmClient, LlmRequest, LlmResult } from '../../src/llm/request';
import { withSharedQueue } from '../../src/llm/sharedQueue';
import { instantScheduler } from '../support/instantScheduler';

const OK: LlmResult = { value: { ok: true } };
const refused = () => new LlmError('model_refused', 'model not allowed');
const rateLimited = (retryAfterMs?: number) =>
  new LlmError('rate_limited', 'slow down', retryAfterMs === undefined ? {} : { retryAfterMs });

type Answer = LlmResult | LlmError;

/** A client that answers from a script in order and remembers each request. */
function scriptedClient(script: readonly Answer[]) {
  const requests: LlmRequest[] = [];
  const client: LlmClient = {
    complete(request) {
      requests.push(request);
      const entry = script[requests.length - 1];
      if (entry === undefined) throw new Error('asked more often than scripted');
      return entry instanceof LlmError ? Promise.reject(entry) : Promise.resolve(entry);
    },
  };
  return { client, requests };
}

const LIGHT: LlmRequest = { kind: 'mente', tier: 'light', prompt: 'ciao' };
const MAIN: LlmRequest = { kind: 'mente', tier: 'main', prompt: 'ciao' };

/** The fields that say which model a request asks for, and how many tries came before it. */
function shape({ tier, lowLatency, attempt }: LlmRequest) {
  return { tier, lowLatency: lowLatency ?? false, attempt: attempt ?? 0 };
}

describe('withSharedQueue, the model fallback (P-01a shared-queue variant, llm.js:42-53)', () => {
  it('passes a successful call through untouched', async () => {
    const { client, requests } = scriptedClient([OK]);
    const { scheduler } = instantScheduler();
    expect(await withSharedQueue(client, scheduler).complete(LIGHT)).toEqual(OK);
    expect(requests).toEqual([{ ...LIGHT, attempt: 0 }]);
  });

  it('fails a denied call at once, with no fallback', async () => {
    const { client, requests } = scriptedClient([new LlmError('denied', 'no')]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    await expect(queue.complete(LIGHT)).rejects.toMatchObject({ code: 'denied' });
    expect(requests).toHaveLength(1);
  });

  it('switches Haiku off and resends the same call as main with lowLatency', async () => {
    const { client, requests } = scriptedClient([refused(), OK, OK]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    expect(await queue.complete(LIGHT)).toEqual(OK);
    expect(requests.map(shape)).toEqual([
      { tier: 'light', lowLatency: false, attempt: 0 },
      { tier: 'main', lowLatency: true, attempt: 1 },
    ]);
    expect(requests[1]).toMatchObject({ kind: 'mente', prompt: 'ciao' });
    await queue.complete(LIGHT);
    expect(shape(requests[2] as LlmRequest)).toEqual({
      tier: 'main',
      lowLatency: true,
      attempt: 0,
    });
  });
});

describe('withSharedQueue, refusals that end the call (llm.js:52)', () => {
  it('fails a refusal on Sonnet, with no fallback', async () => {
    const { client, requests } = scriptedClient([refused()]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    await expect(queue.complete(MAIN)).rejects.toMatchObject({ code: 'model_refused' });
    expect(requests).toHaveLength(1);
  });

  it('fails a refusal on quick Sonnet too', async () => {
    const { client } = scriptedClient([refused()]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    await expect(queue.complete({ ...MAIN, lowLatency: true })).rejects.toMatchObject({
      code: 'model_refused',
    });
  });

  it('fails any other error with no retry', async () => {
    const { client, requests } = scriptedClient([new LlmError('unavailable', 'down')]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    await expect(queue.complete(LIGHT)).rejects.toMatchObject({ code: 'unavailable' });
    expect(requests).toHaveLength(1);
  });
});

describe('withSharedQueue, rate limits and the race (llm.js:42-53, AM2-05)', () => {
  it('waits the reported time, else the Venture schedule, and retries at most 4 times', async () => {
    const script = [rateLimited(), rateLimited(1234), rateLimited(), rateLimited(), rateLimited()];
    const { client, requests } = scriptedClient(script);
    const { scheduler, waits } = instantScheduler();
    await expect(withSharedQueue(client, scheduler).complete(MAIN)).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(waits).toEqual([15_000, 1234, 60_000, 120_000]);
    expect(requests.map(({ attempt }) => attempt)).toEqual([0, 1, 2, 3, 4]);
  });

  it('counts an earlier refusal resend as one of the 4 retries', async () => {
    const { client, requests } = scriptedClient([
      refused(),
      rateLimited(),
      rateLimited(),
      rateLimited(),
      rateLimited(),
    ]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    await expect(queue.complete(LIGHT)).rejects.toMatchObject({ code: 'rate_limited' });
    expect(requests).toHaveLength(5);
  });

  it('resends as main with lowLatency when a concurrent call already switched Haiku off', async () => {
    const { client, requests } = scriptedClient([refused(), refused(), OK, OK]);
    const queue = withSharedQueue(client, instantScheduler().scheduler);
    const both = Promise.all([queue.complete(LIGHT), queue.complete(LIGHT)]);
    await expect(both).resolves.toEqual([OK, OK]);
    expect(requests.map(shape)).toEqual([
      { tier: 'light', lowLatency: false, attempt: 0 },
      { tier: 'light', lowLatency: false, attempt: 0 },
      { tier: 'main', lowLatency: true, attempt: 1 },
      { tier: 'main', lowLatency: true, attempt: 1 },
    ]);
  });
});
