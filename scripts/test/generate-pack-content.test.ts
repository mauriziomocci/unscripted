import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePackContent } from '../generate-pack-content.ts';

const ROOT = join(import.meta.dirname, '..', '..');
/** The vendored legacy source the present pack is generated from (FR-024). */
const ARCHPACK = join(ROOT, 'apps', 'artifact', 'legacy', 'island', 'live', 'archpack.js');

/** Generates the pack into a fresh folder and returns the bytes written. */
function generateOnce(): Buffer {
  const out = join(mkdtempSync(join(tmpdir(), 'pack-content-')), 'archpack.json');
  generatePackContent(ARCHPACK, out);
  return readFileSync(out);
}

describe('generatePackContent', () => {
  it('writes the 16 characters of archpack.js, under the pack label', () => {
    const pack = JSON.parse(generateOnce().toString('utf8')) as { label: string; chars: unknown[] };
    expect(pack.label).toBe('Personaggi pronti');
    expect(pack.chars).toHaveLength(16);
  });

  it('writes byte-identical files on two runs', () => {
    expect(generateOnce().equals(generateOnce())).toBe(true);
  });
});
