import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LLM_CALL_KINDS } from '@unscripted/core';
import { describe, expect, it } from 'vitest';

const LIVE = join(import.meta.dirname, '..', 'legacy', 'island', 'live');

/** Which legacy `ask('<kind>'` literal belongs to which file, the call tier and the line it sits on. */
interface LiteralSite {
  readonly file: string;
  readonly line: number;
  readonly kind: string;
  readonly tier: 'main' | 'light';
}

/** Reads one vendored source of the live folder; the scan sees exactly what the build embeds. */
function readSource(file: string): string {
  return readFileSync(join(LIVE, file), 'utf8');
}

/** The scripts the build embeds: every `.js` of the live folder, tests and tools excluded. */
function liveScripts(): string[] {
  return readdirSync(LIVE)
    .filter((name) => name.endsWith('.js'))
    .sort();
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/**
 * Every `ask('<kind>'` call with a literal kind. The tier is the first
 * `'main'` or `'light'` argument that closes a call after the site and
 * before the next one (a call with no tier is a main call, as in the legacy).
 */
function literalSites(file: string): LiteralSite[] {
  const source = readSource(file);
  const found = [...source.matchAll(/(?<![\w$])ask\('([^']+)'/g)];
  return found.map((match, i) => {
    const end = found[i + 1]?.index ?? source.length;
    const tier = /'(main|light)'\s*\)/.exec(source.slice(match.index, end))?.[1];
    return {
      file,
      line: lineOf(source, match.index),
      kind: match[1] ?? '',
      tier: tier === 'light' ? 'light' : 'main',
    };
  });
}

/** The exact number of literal `ask('` sites of each vendored file (FR-011); any other file has none. */
const LITERAL_SITE_COUNTS: Readonly<Record<string, number>> = {
  'engine.js': 4,
  'env.js': 5,
  'features.js': 5,
  'fun.js': 6,
  'venture.js': 17,
  'romanzo.js': 22,
};

/** The light-tier sites of the Venture and of the novel; every other site of those files is main (FR-011). */
const LIGHT_SITES: Readonly<Record<string, readonly number[]>> = {
  'venture.js': [623, 667, 688, 702],
  'romanzo.js': [338, 347, 381, 583],
};

/**
 * The talk show asks through `tsAsk(prompt, quick)` with no kind: the kinds
 * are the port's names, fixed here per call site. `talk.js:209` asks for the
 * host or for a guest by one expression, so it maps to two kinds.
 */
const TALK_SITES: readonly { file: string; line: number; kinds: readonly string[] }[] = [
  { file: 'talk.js', line: 162, kinds: ['talk-listen'] },
  { file: 'talk.js', line: 209, kinds: ['talk-host', 'talk-guest'] },
  { file: 'talk.js', line: 393, kinds: ['talk-voice'] },
  { file: 'talk.js', line: 679, kinds: ['talk-review'] },
  { file: 'talk.js', line: 692, kinds: ['talk-story'] },
  { file: 'talk.js', line: 710, kinds: ['talk-recap'] },
  { file: 'talkfun.js', line: 83, kinds: ['talk-offair'] },
  { file: 'talkfun.js', line: 129, kinds: ['talk-twist'] },
];

/** The archive generator calls the runtime through its own function; its kind is the port's `archive-generate`. */
const GENERATOR_KIND = 'archive-generate';

const KNOWN_KINDS: ReadonlySet<string> = new Set(LLM_CALL_KINDS);

/** `file:line kind` of each site whose kind the core list does not hold. */
function unknownKinds(sites: readonly { file: string; line: number; kind: string }[]): string[] {
  return sites
    .filter((site) => !KNOWN_KINDS.has(site.kind))
    .map((site) => `${site.file}:${String(site.line)} ${site.kind}`);
}

/** The 1-based lines of every call of `tsAsk(` in a file, its definition excluded. */
function tsAskCalls(file: string): number[] {
  const source = readSource(file);
  return [...source.matchAll(/(?<![\w$])tsAsk\(/g)]
    .filter((match) => !source.slice(match.index - 15, match.index).includes('function'))
    .map((match) => lineOf(source, match.index));
}

/** The lines of the light-tier sites of one file. */
function lightLines(sites: readonly LiteralSite[], file: string): number[] {
  return sites.filter((s) => s.file === file && s.tier === 'light').map((s) => s.line);
}

/** `file:line` of each tsAsk call of one file. */
function tsAskCallIds(file: string): string[] {
  return tsAskCalls(file).map((line) => `${file}:${String(line)}`);
}

/** One entry per kind of the talk table, so the kind check names the site. */
function talkKindSites(): { file: string; line: number; kind: string }[] {
  return TALK_SITES.flatMap(({ file, line, kinds }) => kinds.map((kind) => ({ file, line, kind })));
}

describe('legacy call sites against LLM_CALL_KINDS (FR-011)', () => {
  const literal = liveScripts().flatMap(literalSites);

  it('finds the exact number of literal ask sites in every vendored file', () => {
    const counts: Record<string, number> = {};
    for (const site of literal) counts[site.file] = (counts[site.file] ?? 0) + 1;
    expect(counts).toEqual(LITERAL_SITE_COUNTS);
  });

  it('holds every literal kind in the core list', () => {
    expect(unknownKinds(literal)).toEqual([]);
  });

  it('keeps the light tier of the Venture and of the novel where the spec puts it', () => {
    expect({
      'venture.js': lightLines(literal, 'venture.js'),
      'romanzo.js': lightLines(literal, 'romanzo.js'),
    }).toEqual(LIGHT_SITES);
  });

  it('keeps `god mode` with its space, as the legacy writes it', () => {
    expect(literal.some((s) => s.file === 'engine.js' && s.kind === 'god mode')).toBe(true);
  });

  it('finds exactly the 8 tsAsk call sites of the talk show, mapped to 9 kinds', () => {
    const found = ['talk.js', 'talkfun.js'].flatMap(tsAskCallIds);
    expect(found).toEqual(TALK_SITES.map((site) => `${site.file}:${String(site.line)}`));
    const kinds = TALK_SITES.flatMap((site) => site.kinds);
    expect(kinds).toHaveLength(9);
    expect(new Set(kinds).size).toBe(9);
    expect(unknownKinds(talkKindSites())).toEqual([]);
  });

  it('finds the one call of the archive generator and its direct runtime access', () => {
    const source = readSource('archfuturo.js');
    expect(source.match(/function archGenCall\(/g)).toHaveLength(1);
    expect(source.match(/(?<![\w$])archGenCall\(/g)).toHaveLength(2); // the definition and one call
    expect(source.match(/claude\.use\('sample'\)/g)).toHaveLength(1);
    expect(KNOWN_KINDS.has(GENERATOR_KIND)).toBe(true);
  });
});
