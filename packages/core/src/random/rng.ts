/** A seeded source of randomness; the pure core never calls `Math.random` (A-03). */
export interface Rng {
  /** A number in [0, 1). */
  next(): number;
}

/** Increment of the mulberry32 state on every draw; the constant is part of the algorithm and of the legacy `rngFrom`. */
const STATE_STEP = 0x6d2b79f5;

/** 2^32, the size of the 32-bit output range the draw is divided by to land in [0, 1). */
const OUTPUT_RANGE = 4294967296;

/**
 * mulberry32, the algorithm of the legacy `rngFrom` (`sim.js:5-14`), shared
 * with `tools/golden` so a replay draws the numbers the legacy game drew
 * (FR-012). The seed is wrapped to an unsigned 32-bit integer, as the legacy
 * does, so any finite number is a valid seed.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + STATE_STEP) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / OUTPUT_RANGE;
    },
  };
}
