/**
 * Why a language-model call failed. Callers decide by this code, never by the
 * message text, so a transport (HTTP client, artifact runtime) maps its own
 * failures onto exactly one of these.
 */
export type LlmErrorCode =
  | 'rate_limited'
  | 'timeout'
  | 'unparseable'
  | 'unavailable'
  | 'denied'
  | 'model_refused'
  | 'budget'
  | 'invalid_request';

/** Optional detail of an {@link LlmError}. */
export interface LlmErrorOptions {
  /** Only with `rate_limited`, when the transport gave a wait (S-08); a client never computes one. */
  readonly retryAfterMs?: number;
  readonly cause?: unknown;
}

/** The single error type of the {@link LlmClient} port; the message is for people and logs. */
export class LlmError extends Error {
  readonly code: LlmErrorCode;
  readonly retryAfterMs?: number;

  constructor(code: LlmErrorCode, message: string, options: LlmErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'LlmError';
    this.code = code;
    if (options.retryAfterMs !== undefined) {
      this.retryAfterMs = options.retryAfterMs;
    }
  }
}
