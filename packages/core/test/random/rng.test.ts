import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/random/rng';

/**
 * First 10 values of the legacy `rngFrom` (mulberry32), computed once by
 * running the function copied verbatim from
 * `unscripted-reference/2026-11-17/island/live/sim.js` lines 5-14 (the
 * pinned reference, md5 cbf754483d65f38e593580ee9785c177) with `node -e` in
 * the dev container (Node 22.23.5), for the seeds below. The golden harness
 * and the island replay rely on these exact numbers (FR-012).
 */
const VECTORS: Readonly<Record<number, readonly number[]>> = {
  777: [
    0.6863787178881466, 0.03445141832344234, 0.19238732964731753, 0.12300295010209084,
    0.6329670422710478, 0.3821668648160994, 0.25158999767154455, 0.7428534857463092,
    0.6186862206086516, 0.7734572542831302,
  ],
  0: [
    0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111,
    0.46732782293111086, 0.5450490827206522, 0.6152513844426721, 0.6489853798411787,
    0.45600721263326705, 0.581218967679888,
  ],
  4294967295: [
    0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677,
    0.8452364315744489, 0.5391399988438934, 0.6804977387655526, 0.4755720964167267,
    0.13585773925296962, 0.9884445976931602,
  ],
};

function firstTen(seed: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: 10 }, () => rng.next());
}

describe('createRng', () => {
  it.each([777, 0, 2 ** 32 - 1])('reproduces the legacy mulberry32 for seed %d', (seed) => {
    expect(firstTen(seed)).toEqual(VECTORS[seed]);
  });

  it('keeps every value in [0, 1)', () => {
    const rng = createRng(12345);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('wraps the seed to an unsigned 32-bit integer as the legacy does', () => {
    expect(firstTen(2 ** 32)).toEqual(firstTen(0));
    expect(firstTen(-1)).toEqual(firstTen(2 ** 32 - 1));
  });

  it('gives each generator its own state', () => {
    const first = createRng(777);
    const second = createRng(777);
    first.next();
    expect(second.next()).toBe(VECTORS[777]?.[0]);
  });
});
