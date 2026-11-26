/** The environments (and the one call) that retry on `rate_limited`, each with the pause its legacy loop used. */
export type BackoffScheduleName = 'island' | 'talkshow' | 'venture' | 'archiveGenerate';

/**
 * How one environment waits after the platform says `rate_limited` (S-08).
 * Two counters are involved and must not be confused: the call's own
 * `attempt` decides when to stop retrying ({@link mayRetry}); the `step`
 * decides how long to wait ({@link backoffWaitMs}), and `scope` says where
 * that step comes from. The wait before step `n` is
 * `baseMs * factor^(min(n, maxStep) - 1)`.
 */
export interface BackoffSchedule {
  /** Pause before the first retry, in ms. */
  readonly baseMs: number;
  /** Multiplier applied to the pause at every further step. */
  readonly factor: number;
  /** Retries one call may make before the error reaches its caller. */
  readonly maxRetries: number;
  /** Step after which the pause stops growing; absent when `maxRetries` already bounds it. */
  readonly maxStep?: number;
  /**
   * Where the step comes from. `perCall`: the call's own attempt number plus
   * one. `perGame`: a step shared by every call of the game, raised on each
   * rate limit and reset on success, so it can run past `maxRetries` and is
   * then held at `maxStep`.
   */
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
 * them: island `engine.js:13-37` (one shared step `coolStep`, capped at 5 so
 * the longest wait is 240 s, `attempt < 5`, two calls at once); talk show
 * `talk.js:85` (`15000 * 2 ** attempt`, `attempt < 5`); Venture `llm.js:51`
 * (`COOL_BASE_MS * 2 ** attempt`, `MAX_RETRY` 4, `MAX_INFLIGHT` 2); archive
 * generator `archfuturo.js:109-116` (a sleep inside the one call,
 * `attempt < 3`). Only the island shares its step.
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
  talkshow: { baseMs: LEGACY_BASE_MS, factor: LEGACY_FACTOR, maxRetries: 5, scope: 'perCall' },
  venture: {
    baseMs: LEGACY_BASE_MS,
    factor: LEGACY_FACTOR,
    maxRetries: 4,
    scope: 'perCall',
    maxInFlight: 2,
  },
  archiveGenerate: {
    baseMs: LEGACY_BASE_MS,
    factor: LEGACY_FACTOR,
    maxRetries: 3,
    scope: 'perCall',
  },
};

/** Whether a call that has made `attempt` retries so far (0 on its first failure) may retry again. */
export function mayRetry(schedule: BackoffSchedule, attempt: number): boolean {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError(`backoff attempt must be a non-negative integer, got ${String(attempt)}`);
  }
  return attempt < schedule.maxRetries;
}

/**
 * Wait in ms before the retry at `step` (1-based), held at `maxStep` when the
 * schedule has one. It never returns "stop": whether to retry at all is
 * {@link mayRetry}'s decision. A step that is not a positive integer is a bug
 * in the caller and throws.
 */
export function backoffWaitMs(schedule: BackoffSchedule, step: number): number {
  if (!Number.isInteger(step) || step < 1) {
    throw new RangeError(`backoff step must be a positive integer, got ${String(step)}`);
  }
  const growthSteps = Math.min(step, schedule.maxStep ?? step) - 1;
  return schedule.baseMs * schedule.factor ** growthSteps;
}
