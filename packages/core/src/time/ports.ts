/** Time the core may read; the platform (or a fake in tests) supplies it, because the pure core owns no clock (A-03). */
export interface Clock {
  /** Wall time in ms since the epoch. */
  now(): number;
  /** Monotonic ms, for measuring durations. */
  perfNow(): number;
}

/** Opaque handle of a scheduled timer; only the {@link Scheduler} that returned it can cancel it. */
export interface TimerHandle {
  readonly __timer: unique symbol;
}

/** Timers the core may start; injected so tests and the golden harness can fire them in a chosen order. */
export interface Scheduler {
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(callback: () => void, ms: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
}
