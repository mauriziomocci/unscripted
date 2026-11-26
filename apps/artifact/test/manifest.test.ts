import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LEGACY = join(import.meta.dirname, '..', 'legacy');
/** The two files of the folder that are not vendored sources: the manifest itself and the license texts. */
const NOT_HASHED = new Set(['MANIFEST.sha256', 'LICENSES']);

/** The `shasum -a 256` lines of the manifest as a path-to-hash map. */
function readManifest(): Map<string, string> {
  const lines = readFileSync(join(LEGACY, 'MANIFEST.sha256'), 'utf8').split('\n').filter(Boolean);
  return new Map(
    lines.map((line) => {
      const [hash = '', path = ''] = line.split('  ');
      return [path, hash];
    }),
  );
}

/** The SHA-256 of every vendored file, keyed by its path relative to the legacy folder. */
function hashVendoredFiles(): Map<string, string> {
  const paths = readdirSync(LEGACY, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(LEGACY.length + 1))
    .filter((path) => !NOT_HASHED.has(path));
  return new Map(
    paths.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(join(LEGACY, path)))
        .digest('hex'),
    ]),
  );
}

describe('legacy manifest (FR-080)', () => {
  it('matches every vendored file: no changed, missing or extra file', () => {
    const expected = readManifest();
    const actual = hashVendoredFiles();
    const problems = [
      ...[...expected]
        .filter(([path, hash]) => actual.has(path) && actual.get(path) !== hash)
        .map(([path]) => `changed: ${path}`),
      ...[...expected.keys()].filter((path) => !actual.has(path)).map((path) => `missing: ${path}`),
      ...[...actual.keys()].filter((path) => !expected.has(path)).map((path) => `extra: ${path}`),
    ].sort();
    expect(problems).toEqual([]);
  });
});
