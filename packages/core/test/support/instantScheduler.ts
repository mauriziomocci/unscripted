import type { Scheduler, TimerHandle } from '../../src/time/ports';

/** A scheduler whose timers fire at once, and the waits they were asked for, in order. */
export function instantScheduler(): { scheduler: Scheduler; waits: number[] } {
  const waits: number[] = [];
  const handle = {} as TimerHandle;
  const scheduler: Scheduler = {
    setTimeout(callback, ms) {
      waits.push(ms);
      callback();
      return handle;
    },
    clearTimeout: () => undefined,
    setInterval: () => handle,
    clearInterval: () => undefined,
  };
  return { scheduler, waits };
}
