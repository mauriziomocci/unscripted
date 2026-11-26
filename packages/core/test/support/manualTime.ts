import type { Clock, Scheduler, TimerHandle } from '../../src/time/ports';

/** A clock that only moves when a test says so. */
export interface FakeClock extends Clock {
  advance(ms: number): void;
}

export function fakeClock(startMs = 0): FakeClock {
  let now = startMs;
  return {
    now: () => now,
    perfNow: () => now,
    advance(ms) {
      now += ms;
    },
  };
}

interface Timer {
  readonly id: number;
  readonly dueAt: number;
  readonly callback: () => void;
}

/** A scheduler whose timers fire only when a test advances time; `pendingWaits` lists the waits still open. */
export interface ManualScheduler {
  readonly scheduler: Scheduler;
  readonly cleared: number[];
  pendingWaits(): number[];
  /** Moves the clock forward and fires every timer that falls due, earliest first. */
  advance(ms: number): void;
}

export function manualScheduler(clock: FakeClock): ManualScheduler {
  let timers: Timer[] = [];
  const cleared: number[] = [];
  let counter = 0;
  const scheduler: Scheduler = {
    setTimeout(callback, ms) {
      counter += 1;
      timers.push({ id: counter, dueAt: clock.now() + ms, callback });
      return counter as unknown as TimerHandle;
    },
    clearTimeout(handle) {
      cleared.push(handle as unknown as number);
      timers = timers.filter(({ id }) => id !== (handle as unknown as number));
    },
    setInterval: () => 0 as unknown as TimerHandle,
    clearInterval: () => undefined,
  };
  return {
    scheduler,
    cleared,
    pendingWaits: () => timers.map(({ dueAt }) => dueAt - clock.now()),
    advance(ms) {
      const target = clock.now() + ms;
      for (;;) {
        const due = timers
          .filter(({ dueAt }) => dueAt <= target)
          .sort((a, b) => a.dueAt - b.dueAt)[0];
        if (due === undefined) break;
        timers = timers.filter(({ id }) => id !== due.id);
        clock.advance(due.dueAt - clock.now());
        due.callback();
      }
      clock.advance(target - clock.now());
    },
  };
}
