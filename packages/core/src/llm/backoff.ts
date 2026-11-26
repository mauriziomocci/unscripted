/** The environments (and the one call) that retry on `rate_limited`, each with the pause its legacy loop used. */
export type BackoffScheduleName = 'island' | 'talkshow' | 'venture' | 'archiveGenerate';

/**
 * How one environment waits after the platform says `rate_limited`: the pause
 * before retry number `step` is `baseMs * factor^(min(step, maxStep) - 1)`.
 */
export interface BackoffSchedule {
  /** Pause before the first retry, in ms. */
  readonly baseMs: number;
  /** Multiplier applied to the pause at every further retry. */
  readonly factor: number;
  /** Retries allowed before the call gives up and the error reaches the caller. */
  readonly maxRetries: number;
  /** Step after which the pause stops growing; absent when `maxRetries` already bounds it. */
  readonly maxStep?: number;
  /** `perGame`: one pause shared by every call of the game; `perCall`: each call waits alone. */
  readonly scope: 'perGame' | 'perCall';
  /** Calls allowed in flight at once; absent when the legacy code set no limit. */
  readonly maxInFlight?: number;
}

/** The four named schedules, as one value so a server and a client cannot disagree about them. */
export type BackoffPolicy = Readonly<Record<BackoffScheduleName, BackoffSchedule>>;

/** Pause every legacy loop starts from: 15 s, long enough for a rate window to clear. */
const LEGACY_BASE_MS = 15_000;

/** Every legacy loop doubled its pause at each retry. */
const LEGACY_FACTOR = 2;

/**
 * The legacy loops, kept apart because their caps differ and goldens replay
 * them: island `engine.js:13-37` (shared pause, `attempt < 5`, step capped at
 * 5 so the longest wait is 240 s, two calls at once); talk show
 * `talk.js:78-87` (shared `TS.cool`, `attempt < 5`); Venture `llm.js:39-55`
 * (shared pause, `MAX_RETRY` 4, `MAX_INFLIGHT` 2); archive generator
 * `archfuturo.js:109-116` (a sleep inside the one call, `attempt < 3`).
 */
export const BACKOFF_SCHEDULES: BackoffPolicy = {
  island: {
    baseMs: LEGACY_BASE_MS,
    factor: LEGACY_FACTOR,
    maxRetries: 5,
    maxStep: 5,
    scope: 'perGame',
    maxInFlight: 2,
  },
  talkshow: { baseMs: LEGACY_BASE_MS, factor: LEGACY_FACTOR, maxRetries: 5, scope: 'perGame' },
  venture: {
    baseMs: LEGACY_BASE_MS,
    factor: LEGACY_FACTOR,
    maxRetries: 4,
    scope: 'perGame',
    maxInFlight: 2,
  },
  archiveGenerate: {
    baseMs: LEGACY_BASE_MS,
    factor: LEGACY_FACTOR,
    maxRetries: 3,
    scope: 'perCall',
  },
};

/**
 * Wait in ms before retry number `step` (1-based), or `null` when the
 * schedule is exhausted and the error must reach the caller. A step that is
 * not a positive integer is a bug in the caller and throws.
 */
export function backoffWaitMs(schedule: BackoffSchedule, step: number): number | null {
  if (!Number.isInteger(step) || step < 1) {
    throw new RangeError(`backoff step must be a positive integer, got ${String(step)}`);
  }
  if (step > schedule.maxRetries) return null;
  const growthSteps = Math.min(step, schedule.maxStep ?? step) - 1;
  return schedule.baseMs * schedule.factor ** growthSteps;
}
