import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createRng } from '@unscripted/core';
import { describe, expect, it } from 'vitest';

const SIM = join(import.meta.dirname, '..', 'legacy', 'island', 'sim.js');
/** The seeds of FR-012: zero, the golden seed and the largest unsigned 32-bit integer. */
const SEEDS = [0, 777, 2 ** 32 - 1];
const DRAWS = 1000;

/** The source text of `rngFrom`, from its `function` line to the closing brace at the same indent. */
function rngFromSource(): string {
  const lines = readFileSync(SIM, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith('  function rngFrom('));
  const end = lines.findIndex((line, i) => i > start && line === '  }');
  return lines.slice(start, end + 1).join('\n');
}

/** Draws `DRAWS` values from the legacy generator, evaluated in a separate context. */
function legacyDraws(seed: number): number[] {
  const draw = runInNewContext(`${rngFromSource()}; rngFrom(${String(seed)})`) as () => number;
  return Array.from({ length: DRAWS }, () => draw());
}

describe('core Rng against the legacy mulberry32 (FR-012)', () => {
  it.each(SEEDS)('draws the same values as `rngFrom` for seed %d', (seed) => {
    const rng = createRng(seed);
    const core = Array.from({ length: DRAWS }, () => rng.next());
    expect(core).toEqual(legacyDraws(seed));
  });
});
