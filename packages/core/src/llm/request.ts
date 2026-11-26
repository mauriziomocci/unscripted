import type { LlmCallKind } from './kinds';

/** Which model class a call needs: `main` for character lines and decisions, `light` for listening, chorus and twists. */
export type LlmTier = 'main' | 'light';

/** A JSON Schema document the transport may hand to the provider to constrain the answer. */
export type JsonSchema = Readonly<Record<string, unknown>>;

/**
 * The part of the standard abort signal the core needs. Declared here because
 * the pure core has no DOM types (A-03); the platform `AbortSignal` is
 * assignable to it.
 */
export interface LlmAbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

/** One logical call to a language model. */
export interface LlmRequest {
  readonly kind: LlmCallKind;
  readonly tier: LlmTier;
  /** Meaningful only with tier `main` (P-01a); never named `quick`. */
  readonly lowLatency?: boolean;
  /** 0 on the first try, at most 5 (S-08, FR-028). Core alone counts attempts. */
  readonly attempt?: number;
  readonly prompt: string;
  readonly schema?: JsonSchema;
  readonly maxTokens?: number;
  readonly gameId?: string;
  readonly signal?: LlmAbortSignal;
}

/** The answer of one call. */
export interface LlmResult {
  /** The already-parsed JSON answer (P-01, C3); the caller validates it with zod before use. */
  readonly value: unknown;
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number };
}

/** The only door from the game to a language model; implemented per platform (HTTP, artifact runtime). */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResult>;
}
