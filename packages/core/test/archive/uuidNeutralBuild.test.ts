import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/**
 * U-8 (research R-11): the artifact bundles the browser (neutral) build of
 * `uuid`, which must compute v5 without platform crypto. Vitest runs under
 * Node and resolves the `node` build, so this test loads the neutral build by
 * path, with `globalThis.crypto` removed, and compares with the committed
 * vector of `ids.test.ts`. A `uuid` upgrade that starts needing crypto fails here.
 */
const NAMESPACE = 'f0338bcd-0d4a-461e-9b1f-5c8a0414a6bc';
const V5_OF_C_X1 = '61f90bcf-539e-5fae-a21c-c0f0f7ea8561';

const neutralBuild = join(
  dirname(createRequire(import.meta.url).resolve('uuid/package.json')),
  'dist',
);

describe('the neutral build of uuid (U-8)', () => {
  it('does not reference crypto in the files v5 uses', () => {
    for (const file of ['sha1.js', 'v5.js', 'v35.js']) {
      expect(readFileSync(join(neutralBuild, file), 'utf8')).not.toContain('crypto');
    }
  });

  it('computes the committed v5 vector with no global crypto', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      const { v5 } = (await import(pathToFileURL(join(neutralBuild, 'index.js')).href)) as {
        v5: (name: string, namespace: string) => string;
      };
      expect(v5('c_x1', NAMESPACE)).toBe(V5_OF_C_X1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
