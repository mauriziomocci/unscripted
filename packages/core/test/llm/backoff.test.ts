import { describe, expect, it } from 'vitest';
import { BACKOFF_SCHEDULES, backoffWaitMs, type BackoffSchedule } from '../../src/llm/backoff';

/** Waits of the legacy loops: 15 s doubling each time (engine.js:13-37, talk.js:78-87, llm.js:39-55, archfuturo.js:109-116). */
const SECONDS = (...values: number[]): number[] => values.map((value) => value * 1000);

function allWaits(schedule: BackoffSchedule): (number | null)[] {
  return Array.from({ length: schedule.maxRetries + 1 }, (_, i) => backoffWaitMs(schedule, i + 1));
}

describe('BACKOFF_SCHEDULES', () => {
  it('has the four schedules of the legacy environments', () => {
    expect(Object.keys(BACKOFF_SCHEDULES)).toEqual([
      'island',
      'talkshow',
      'venture',
      'archiveGenerate',
    ]);
  });

  it('describes the island: shared pause, five retries, 240 s cap, two calls at once', () => {
    expect(BACKOFF_SCHEDULES.island).toEqual({
      baseMs: 15000,
      factor: 2,
      maxRetries: 5,
      maxStep: 5,
      scope: 'perGame',
      maxInFlight: 2,
    });
  });

  it('describes the talk show: shared pause, five retries, no limit on calls at once', () => {
    expect(BACKOFF_SCHEDULES.talkshow).toEqual({
      baseMs: 15000,
      factor: 2,
      maxRetries: 5,
      scope: 'perGame',
    });
  });
});

describe('BACKOFF_SCHEDULES of the other environments', () => {
  it('describes Venture: shared pause, four retries, two calls at once', () => {
    expect(BACKOFF_SCHEDULES.venture).toEqual({
      baseMs: 15000,
      factor: 2,
      maxRetries: 4,
      scope: 'perGame',
      maxInFlight: 2,
    });
  });

  it('describes the archive generator: pause per call, three retries', () => {
    expect(BACKOFF_SCHEDULES.archiveGenerate).toEqual({
      baseMs: 15000,
      factor: 2,
      maxRetries: 3,
      scope: 'perCall',
    });
  });
});

describe('backoffWaitMs', () => {
  it('gives the island waits 15, 30, 60, 120, 240 s, then stops', () => {
    expect(allWaits(BACKOFF_SCHEDULES.island)).toEqual([...SECONDS(15, 30, 60, 120, 240), null]);
  });

  it('gives the talk show the same five waits, then stops', () => {
    expect(allWaits(BACKOFF_SCHEDULES.talkshow)).toEqual([...SECONDS(15, 30, 60, 120, 240), null]);
  });

  it('gives Venture 15, 30, 60, 120 s, then stops', () => {
    expect(allWaits(BACKOFF_SCHEDULES.venture)).toEqual([...SECONDS(15, 30, 60, 120), null]);
  });

  it('gives the archive generator 15, 30, 60 s, then stops', () => {
    expect(allWaits(BACKOFF_SCHEDULES.archiveGenerate)).toEqual([...SECONDS(15, 30, 60), null]);
  });

  it('stops growing at maxStep', () => {
    const capped: BackoffSchedule = {
      baseMs: 1000,
      factor: 2,
      maxRetries: 10,
      maxStep: 3,
      scope: 'perCall',
    };
    expect([3, 4, 10].map((step) => backoffWaitMs(capped, step))).toEqual([4000, 4000, 4000]);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'refuses step %s, which is not a 1-based retry number',
    (step) => {
      expect(() => backoffWaitMs(BACKOFF_SCHEDULES.island, step)).toThrow(RangeError);
    },
  );
});
