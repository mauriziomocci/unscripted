import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnjustifiedExemptions } from '../check-taste-exemptions.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'taste-exemptions');

describe('check-taste-exemptions', () => {
  it('reports every disable and every jscpd ignore without a written reason, whatever the rule', () => {
    expect(findUnjustifiedExemptions(FIXTURES)).toEqual([
      expect.objectContaining({ file: 'bare-structural-disable.ts', line: 1 }),
      expect.objectContaining({ file: 'unjustified-disable.ts', line: 1 }),
      expect.objectContaining({ file: 'unjustified-jscpd.ts', line: 1 }),
    ]);
  });
});
