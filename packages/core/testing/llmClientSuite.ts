import { describe, expect, it } from 'vitest';
import { LlmError, type LlmErrorCode } from '../src/llm/errors';
import type { LlmClient, LlmRequest } from '../src/llm/request';

/**
 * What the transport under test is armed to do for the next call. Each
 * implementation maps it to its own wire: a stubbed `fetch` answer for
 * `HttpLlmClient`, a stubbed runtime for `ArtifactLlmClient`.
 */
export type LlmScenario =
  | { readonly outcome: 'success'; readonly value: unknown }
  /** `retryAfterMs` is what the transport reports (the `Retry-After` header, in ms); absent when it reports none. */
  | { readonly outcome: 'rate_limited'; readonly retryAfterMs?: number }
  | { readonly outcome: 'budget' }
  /** The call never completes by itself: only the abort signal ends it. */
  | { readonly outcome: 'never_answers' }
  /** A failure the transport reports with this code. */
  | {
      readonly outcome: 'failure';
      readonly code: Exclude<LlmErrorCode, 'rate_limited' | 'budget' | 'timeout'>;
    };

/** Builds a client armed with the scenario for one test. */
export type LlmClientFactory = (scenario: LlmScenario) => LlmClient | Promise<LlmClient>;

const REQUEST: LlmRequest = { kind: 'mente', tier: 'main', prompt: 'ciao' };

/** The call rejects with an `LlmError` that has (at least) these fields. */
async function expectFailure(
  client: LlmClient,
  expected: { readonly code: LlmErrorCode; readonly retryAfterMs?: number },
  request: LlmRequest = REQUEST,
): Promise<void> {
  const call = client.complete(request);
  await expect(call).rejects.toBeInstanceOf(LlmError);
  await expect(call).rejects.toMatchObject(expected);
}

function describeAnswers(factory: LlmClientFactory): void {
  it('returns the value of a successful call', async () => {
    const client = await factory({ outcome: 'success', value: { scheda: 'testo' } });
    expect(await client.complete(REQUEST)).toMatchObject({ value: { scheda: 'testo' } });
  });

  it('turns a rate limit into rate_limited with the wait the transport reported', async () => {
    const client = await factory({ outcome: 'rate_limited', retryAfterMs: 2000 });
    await expectFailure(client, { code: 'rate_limited', retryAfterMs: 2000 });
  });

  it('leaves the wait out when the transport reported none', async () => {
    const client = await factory({ outcome: 'rate_limited' });
    const call = client.complete(REQUEST);
    await expect(call).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(call).rejects.not.toHaveProperty('retryAfterMs');
  });

  it('turns a budget refusal into budget', async () => {
    await expectFailure(await factory({ outcome: 'budget' }), { code: 'budget' });
  });
}

function describeFailures(factory: LlmClientFactory): void {
  it('ends a call with timeout when the abort signal fires', async () => {
    const client = await factory({ outcome: 'never_answers' });
    const controller = new AbortController();
    const pending = expectFailure(
      client,
      { code: 'timeout' },
      { ...REQUEST, signal: controller.signal },
    );
    controller.abort();
    await pending;
  });

  it.each(['denied', 'model_refused', 'unparseable', 'unavailable', 'invalid_request'] as const)(
    'keeps the code %s of any other failure',
    async (code) => {
      await expectFailure(await factory({ outcome: 'failure', code }), { code });
    },
  );
}

/**
 * The scenarios of FR-053 every `LlmClient` must pass, whatever its transport:
 * the same assertions run on `HttpLlmClient` and `ArtifactLlmClient`, so the
 * two forms of the game classify a failure the same way and core can decide
 * the fallback by code alone. Core has no implementation of its own, so the
 * suite first runs in the apps.
 */
export function describeLlmClient(name: string, factory: LlmClientFactory): void {
  describe(`LlmClient: ${name}`, () => {
    describe('answers', () => {
      describeAnswers(factory);
    });
    describe('failures', () => {
      describeFailures(factory);
    });
  });
}
