import type { Scheduler, TimerHandle } from '../../src/time/ports';
import type { FakeClock } from './manualTime';

/** A scheduler whose timers fire at once, and the waits they were asked for, in order; given a clock, it moves it by each wait. */
export function instantScheduler(clock?: FakeClock): { scheduler: Scheduler; waits: number[] } {
  const waits: number[] = [];
  const handle = {} as TimerHandle;
  const scheduler: Scheduler = {
    setTimeout(callback, ms) {
      waits.push(ms);
      clock?.advance(ms);
      callback();
      return handle;
    },
    clearTimeout: () => undefined,
    setInterval: () => handle,
    clearInterval: () => undefined,
  };
  return { scheduler, waits };
}
