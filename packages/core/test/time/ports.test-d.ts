import { expectTypeOf } from 'vitest';
import type { Downloads, Speech } from '../../src/capabilities';
import type { Clock, Scheduler, TimerHandle } from '../../src/time/ports';

// Type-level proof (checked by `tsc -b`, nothing runs): a plain object with the
// documented members is a valid implementation of each port.
const handle = {} as TimerHandle;

const clock = { now: () => 0, perfNow: () => 0 } satisfies Clock;

const scheduler = {
  setTimeout: () => handle,
  clearTimeout: () => undefined,
  setInterval: () => handle,
  clearInterval: () => undefined,
} satisfies Scheduler;

const speech = { speak: () => undefined, stop: () => undefined } satisfies Speech;

const downloads = { save: () => undefined } satisfies Downloads;

expectTypeOf(clock).toExtend<Clock>();
expectTypeOf(scheduler).toExtend<Scheduler>();
expectTypeOf(speech).toExtend<Speech>();
expectTypeOf(downloads).toExtend<Downloads>();

// A timer handle is opaque: a bare number cannot stand in for it.
// @ts-expect-error a number is not a TimerHandle
const notAHandle: TimerHandle = 1;
export { notAHandle };
