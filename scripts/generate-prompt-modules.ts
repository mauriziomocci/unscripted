import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
/** Where the prompt assets live: the single source (spec 2.7). */
const PROMPTS_DIR = join(ROOT, 'packages', 'core', 'prompts');
/** Where their generated modules are committed: core never reads files, it imports these (R-26). */
const MODULES_DIR = join(ROOT, 'packages', 'core', 'src', 'prompts');

/** The module for one prompt: the text as a JSON string literal, which every JavaScript engine reads back exactly. */
function moduleSource(source: string, text: string): string {
  return [
    '/**',
    ` * Generated from ${source} by \`pnpm content:generate\`: do not edit,`,
    ' * change the Markdown file and run the command again.',
    ' */',
    `export const TEXT = ${JSON.stringify(text)};`,
    '',
  ].join('\n');
}

/**
 * Writes one TypeScript module per Markdown file under `srcDir`, at the same
 * relative path under `outDir` with a `.ts` extension. Deterministic: the same
 * files give the same bytes, so a test can compare a fresh run with the
 * committed modules.
 */
export function generatePromptModules(srcDir: string, outDir: string): void {
  const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.md'))
    .sort();
  for (const file of files) {
    const target = join(outDir, file.replace(/\.md$/, '.ts'));
    mkdirSync(dirname(target), { recursive: true });
    const text = readFileSync(join(srcDir, file), 'utf8');
    writeFileSync(target, moduleSource(relative(ROOT, join(srcDir, file)), text));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generatePromptModules(PROMPTS_DIR, MODULES_DIR);
}
