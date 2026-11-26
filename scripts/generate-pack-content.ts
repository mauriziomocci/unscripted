import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
/** The vendored legacy source holding the ready-made characters (`const ARCH_PACK = {...}`, FR-024). */
const ARCHPACK_SOURCE = join(ROOT, 'apps', 'artifact', 'legacy', 'island', 'live', 'archpack.js');
/** Where the generated content is committed: core imports it, it never evaluates legacy code (A-03). */
const ARCHPACK_JSON = join(ROOT, 'packages', 'core', 'src', 'content', 'archpack.json');

/**
 * Evaluates the legacy pack source in a separate context and writes its
 * `ARCH_PACK` value as JSON. The `const` is a script-level binding, not a
 * global property, so the expression `ARCH_PACK` is appended to read it.
 * Deterministic: the same source gives the same bytes, so a test can compare
 * a fresh run with the committed file.
 */
export function generatePackContent(sourceFile: string, outFile: string): void {
  const pack: unknown = runInNewContext(`${readFileSync(sourceFile, 'utf8')}\n;ARCH_PACK`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(pack, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generatePackContent(ARCHPACK_SOURCE, process.argv[2] ?? ARCHPACK_JSON);
}
