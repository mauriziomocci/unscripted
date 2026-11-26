import type { Scheduler } from './ports';

/** Resolves after `ms` on the injected scheduler, so a test chooses when the wait ends. */
export function pause(scheduler: Scheduler, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scheduler.setTimeout(resolve, ms);
  });
}
