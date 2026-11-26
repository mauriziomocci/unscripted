import { describe, expect, it } from 'vitest';
import { LlmError } from '../../src/llm/errors';

describe('LlmError', () => {
  it('is an Error that keeps its code, message and retry wait', () => {
    const error = new LlmError('rate_limited', 'slow down', { retryAfterMs: 2000 });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.name).toBe('LlmError');
    expect(error.code).toBe('rate_limited');
    expect(error.message).toBe('slow down');
    expect(error.retryAfterMs).toBe(2000);
  });

  it('has no retry wait when the transport gave none', () => {
    expect(new LlmError('timeout', 'too slow').retryAfterMs).toBeUndefined();
  });

  it('keeps the cause it wraps', () => {
    const cause = new Error('socket closed');
    expect(new LlmError('unavailable', 'down', { cause }).cause).toBe(cause);
  });

  it('accepts only the codes of LlmErrorCode', () => {
    // @ts-expect-error 'exploded' is not an LlmErrorCode
    const error = new LlmError('exploded', 'nope');
    expect(error.code).toBe('exploded');
  });
});
