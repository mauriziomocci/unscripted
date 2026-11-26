import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generatePromptModules } from '../generate-prompt-modules.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const PROMPTS = join(ROOT, 'packages', 'core', 'prompts');
const MODULES = join(ROOT, 'packages', 'core', 'src', 'prompts');

/** A prompt that carries every character a template literal would mangle, a CRLF line and a trailing newline. */
const AWKWARD = 'a `tick`, ${x}, $&, back\\slash\r\nnext line « è »\n';

/** Paths of the files below `dir` with the given extension, relative to it. */
function filesUnder(dir: string, extension: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith(extension))
    .sort();
}

function freshFolders(): { src: string; out: string } {
  const base = mkdtempSync(join(tmpdir(), 'prompt-modules-'));
  const src = join(base, 'src');
  mkdirSync(src);
  return { src, out: join(base, 'out') };
}

describe('generatePromptModules', () => {
  it('writes a module whose TEXT is the file text exactly, byte for byte', async () => {
    const { src, out } = freshFolders();
    writeFileSync(join(src, 'a.md'), AWKWARD);
    generatePromptModules(src, out);
    const module = (await import(pathToFileURL(join(out, 'a.ts')).href)) as { TEXT: string };
    expect(module.TEXT).toBe(AWKWARD);
  });

  it('is byte-identical on a second run and names its source in a header', () => {
    const { src, out } = freshFolders();
    writeFileSync(join(src, 'a.md'), AWKWARD);
    generatePromptModules(src, out);
    const first = readFileSync(join(out, 'a.ts'), 'utf8');
    generatePromptModules(src, out);
    expect(readFileSync(join(out, 'a.ts'), 'utf8')).toBe(first);
    expect(first).toMatch(/^\/\*\*[\s\S]*a\.md[\s\S]*content:generate/);
  });

  it('keeps the folder layout of the prompts', () => {
    const { src, out } = freshFolders();
    mkdirSync(join(src, 'it'));
    writeFileSync(join(src, 'it', 'b.md'), 'testo');
    generatePromptModules(src, out);
    expect(filesUnder(out, '.ts')).toEqual([join('it', 'b.ts')]);
  });
});

describe('the committed prompt modules', () => {
  it('equal a fresh generation, and none lacks its markdown source', () => {
    const { out } = freshFolders();
    generatePromptModules(PROMPTS, out);
    const expected = filesUnder(out, '.ts');
    expect(filesUnder(MODULES, '.ts')).toEqual(expected);
    for (const file of expected) {
      expect(readFileSync(join(MODULES, file), 'utf8'), relative(ROOT, join(MODULES, file))).toBe(
        readFileSync(join(out, file), 'utf8'),
      );
    }
  });
});
