import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const COMMITTED = join(ROOT, 'packages', 'core', 'src', 'content', 'archpack.json');

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

describe('the committed present pack (FR-024)', () => {
  it('is what a fresh generation from the vendored archpack.js writes, byte for byte', () => {
    const fresh = join(mkdtempSync(join(tmpdir(), 'archpack-')), 'archpack.json');
    execFileSync('node', [join(ROOT, 'scripts', 'generate-pack-content.ts'), fresh], {
      cwd: ROOT,
    });
    expect(sha256(readFileSync(COMMITTED))).toBe(sha256(readFileSync(fresh)));
  });
});
