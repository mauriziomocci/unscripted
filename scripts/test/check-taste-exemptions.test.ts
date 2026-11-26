import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnjustifiedExemptions } from '../check-taste-exemptions.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'taste-exemptions');

describe('check-taste-exemptions', () => {
  it('reports a taste-rule disable and a jscpd ignore that have no written reason', () => {
    expect(findUnjustifiedExemptions(FIXTURES)).toEqual([
      expect.objectContaining({ file: 'unjustified-disable.ts', line: 1 }),
      expect.objectContaining({ file: 'unjustified-jscpd.ts', line: 1 }),
    ]);
  });

  it('accepts a disable carrying taste-exempt with a reason, and a disable of another rule', () => {
    const files = findUnjustifiedExemptions(FIXTURES).map((violation) => violation.file);
    expect(files).not.toContain('justified-disable.ts');
    expect(files).not.toContain('other-rule-disable.ts');
  });
});
