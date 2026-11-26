import { describe, expect, it } from 'vitest';
import {
  BACKOFF_SCHEDULES,
  backoffWaitMs,
  mayRetry,
  type BackoffSchedule,
} from '../../src/llm/backoff';

/** Waits of the legacy loops: 15 s doubling each time (engine.js:13-37, talk.js:78-87, llm.js:39-55, archfuturo.js:109-116). */
const SECONDS = (...values: number[]): number[] => values.map((value) => value * 1000);

/** Waits of a call that fails until its retries run out: attempt a waits step a + 1. */
function waitsOfOneCall(schedule: BackoffSchedule): number[] {
  return Array.from({ length: schedule.maxRetries }, (_, attempt) =>
    backoffWaitMs(schedule, attempt + 1),
  );
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

  it('describes the talk show: pause per call, five retries (talk.js:85), no limit on calls at once', () => {
    expect(BACKOFF_SCHEDULES.talkshow).toEqual({
      baseMs: 15000,
      factor: 2,
      maxRetries: 5,
      scope: 'perCall',
    });
  });
});

describe('BACKOFF_SCHEDULES of the other environments', () => {
  it('describes Venture: pause per call (llm.js:51), four retries, two calls at once', () => {
    expect(BACKOFF_SCHEDULES.venture).toEqual({
      baseMs: 15000,
      factor: 2,
      maxRetries: 4,
      scope: 'perCall',
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
    expect(waitsOfOneCall(BACKOFF_SCHEDULES.island)).toEqual(SECONDS(15, 30, 60, 120, 240));
  });

  it('gives the talk show the same five waits, then stops', () => {
    expect(waitsOfOneCall(BACKOFF_SCHEDULES.talkshow)).toEqual(SECONDS(15, 30, 60, 120, 240));
  });

  it('gives Venture 15, 30, 60, 120 s, then stops', () => {
    expect(waitsOfOneCall(BACKOFF_SCHEDULES.venture)).toEqual(SECONDS(15, 30, 60, 120));
  });

  it('gives the archive generator 15, 30, 60 s, then stops', () => {
    expect(waitsOfOneCall(BACKOFF_SCHEDULES.archiveGenerate)).toEqual(SECONDS(15, 30, 60));
  });

  it('keeps the island at 240 s when the shared step runs past its cap', () => {
    expect([6, 7, 50].map((step) => backoffWaitMs(BACKOFF_SCHEDULES.island, step))).toEqual(
      SECONDS(240, 240, 240),
    );
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

describe('mayRetry', () => {
  it.each([
    ['island', 5],
    ['talkshow', 5],
    ['venture', 4],
    ['archiveGenerate', 3],
  ] as const)('lets a %s call retry after attempts 0 to %d - 1 and no more', (name, retries) => {
    const schedule = BACKOFF_SCHEDULES[name];
    expect(mayRetry(schedule, retries - 1)).toBe(true);
    expect(mayRetry(schedule, retries)).toBe(false);
  });

  it('decides by the call attempt, not by the wait step: a shared island step of 6 still waits', () => {
    expect(mayRetry(BACKOFF_SCHEDULES.island, 0)).toBe(true);
    expect(backoffWaitMs(BACKOFF_SCHEDULES.island, 6)).toBe(240_000);
  });

  it.each([-1, 1.5, Number.NaN])('refuses attempt %s', (attempt) => {
    expect(() => mayRetry(BACKOFF_SCHEDULES.island, attempt)).toThrow(RangeError);
  });
});
