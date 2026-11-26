import { describe, expect, it } from 'vitest';
import type { Character, CharacterInput } from '../../src/archive/character';
import {
  type GeneratorDeps,
  type GeneratorOptions,
  generateCharacter,
  parseGeneratedCharacter,
} from '../../src/archive/generate';
import { LlmError } from '../../src/llm/errors';
import type { LlmClient, LlmRequest, LlmResult } from '../../src/llm/request';
import { instantScheduler } from '../support/instantScheduler';

const CLOCK = { now: () => Date.parse('2026-11-27T09:30:00.000Z'), perfNow: () => 0 };
const OPTIONS: GeneratorOptions = {
  role: 'timoniere',
  sex: 'f',
  tone: 'serio',
  style: '',
  trait: '',
};

/** A well-formed sheet of at least 200 characters, with a name and a relation by name. */
function sheet(name = 'Lena Voss'): string {
  return [
    `# ${name}`,
    'Età: 38',
    'Sesso: donna',
    'Temperamento: ironico',
    'In breve: Una pilota che parla poco.',
    '',
    '## Storia di vita',
    'Cresciuta su una colonia mineraria, ha imparato a guidare navette prima di imparare a scrivere.',
    '## Carattere',
    'Asciutta, precisa, con un umorismo che si nota solo dopo un po.',
    '## Rapporti',
    '- Ada Verdi: colleghi, 2, "la migliore che conosco"',
  ].join('\n');
}

describe('parseGeneratedCharacter (archfuturo.js:119-124)', () => {
  const parse = (answer: unknown) => parseGeneratedCharacter(answer, 'timoniere', CLOCK);

  it('reads a sheet as a future character of the role, with an origin dated by the clock', () => {
    const result = parse({ scheda: sheet() });
    expect(result).toMatchObject({
      character: {
        name: 'Lena Voss',
        era: 'futuro',
        role: 'timoniere',
        origin: { env: 'venture', label: 'generato con Claude · 27/11' },
      },
    });
  });

  it.each([
    ['not an object', 'testo'],
    ['no scheda', {}],
    ['scheda not a string', { scheda: 5 }],
    ['too short', { scheda: 'x'.repeat(199) }],
    ['too long', { scheda: 'x'.repeat(20001) }],
  ])('refuses an answer that is %s', (_name, answer) => {
    expect(parse(answer)).toEqual({ error: 'La scheda generata non è valida, riprova.' });
  });

  it('accepts the two ends of the length range', () => {
    const header = '# Nome Valido\n';
    const body = (length: number) => header + 'a'.repeat(length - header.length);
    expect(parse({ scheda: body(200) })).toHaveProperty('character');
    expect(parse({ scheda: body(20000) })).toHaveProperty('character');
  });

  it('requires a name that is not the file name «generata»', () => {
    const nameless = `## Storia di vita\n${'a'.repeat(250)}`;
    expect(parse({ scheda: nameless })).toEqual({
      error: 'La scheda generata non ha un nome, riprova.',
    });
  });

  it('strips < and > from the name and cuts it to 40 characters', () => {
    const result = parse({ scheda: sheet(`<b>${'N'.repeat(60)}</b>`) });
    expect((result as { character: CharacterInput }).character.name).toBe('b' + 'N'.repeat(39));
  });
});

/** An LlmClient that answers from a script and remembers what it was asked. */
function scriptedClient(script: readonly (LlmResult | LlmError)[]) {
  const requests: LlmRequest[] = [];
  const client: LlmClient = {
    complete(request) {
      requests.push(request);
      const next = script[requests.length - 1];
      if (next === undefined) throw new Error('the client was asked more than scripted');
      return next instanceof LlmError ? Promise.reject(next) : Promise.resolve(next);
    },
  };
  return { client, requests };
}

const rateLimited = () => new LlmError('rate_limited', 'too many calls');

function deps(): { deps: GeneratorDeps; waits: number[] } {
  const { scheduler, waits } = instantScheduler();
  return { deps: { clock: CLOCK, newId: () => 'unused', scheduler }, waits };
}

describe('generateCharacter (archfuturo.js:109-116, 144-149)', () => {
  it('asks once, as an archive-generate call on the main tier, and returns a preview', async () => {
    const { client, requests } = scriptedClient([{ value: { scheda: sheet() } }]);
    const { deps: generatorDeps } = deps();
    const result = await generateCharacter(client, OPTIONS, [], generatorDeps);
    expect(result).toMatchObject({ character: { name: 'Lena Voss', era: 'futuro' } });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ kind: 'archive-generate', tier: 'main', attempt: 0 });
    expect(requests[0]?.prompt).toContain('RUOLO: timoniere');
  });

  it('turns the relations of the sheet into links to the crew that exists, in the preview', async () => {
    const ada = { id: 'ada-id', name: 'Ada Verdi', era: 'futuro', status: 'vivo' } as Character;
    const { client } = scriptedClient([{ value: { scheda: sheet() } }]);
    const result = await generateCharacter(client, OPTIONS, [ada], deps().deps);
    const { character } = result as { character: CharacterInput };
    expect(character.relations).toEqual([
      { to: 'ada-id', type: 'colleghi', int: 2, view: 'la migliore che conosco' },
    ]);
    expect(character.pendingRelations).toEqual([]);
  });
});

describe('generateCharacter retries (archfuturo.js:109-116)', () => {
  it('retries a rate limit on the archiveGenerate schedule: 15 s, 30 s, 60 s, then gives up', async () => {
    const { client, requests } = scriptedClient([
      rateLimited(),
      rateLimited(),
      rateLimited(),
      rateLimited(),
    ]);
    const { deps: generatorDeps, waits } = deps();
    await expect(generateCharacter(client, OPTIONS, [], generatorDeps)).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(waits).toEqual([15_000, 30_000, 60_000]);
    expect(requests.map(({ attempt }) => attempt)).toEqual([0, 1, 2, 3]);
  });

  it('waits the time the server reported before the retry', async () => {
    const limited = new LlmError('rate_limited', 'slow down', { retryAfterMs: 1234 });
    const { client } = scriptedClient([limited, { value: { scheda: sheet() } }]);
    const { deps: generatorDeps, waits } = deps();
    await generateCharacter(client, OPTIONS, [], generatorDeps);
    expect(waits).toEqual([1234]);
  });
});

describe('generateCharacter, after a rate limit (archfuturo.js:109-116)', () => {
  it('succeeds after a rate limit', async () => {
    const { client } = scriptedClient([rateLimited(), { value: { scheda: sheet() } }]);
    const { deps: generatorDeps, waits } = deps();
    expect(await generateCharacter(client, OPTIONS, [], generatorDeps)).toHaveProperty('character');
    expect(waits).toEqual([15_000]);
  });

  it('does not retry any other error', async () => {
    const { client, requests } = scriptedClient([new LlmError('denied', 'no')]);
    await expect(generateCharacter(client, OPTIONS, [], deps().deps)).rejects.toMatchObject({
      code: 'denied',
    });
    expect(requests).toHaveLength(1);
  });

  it('returns the refusal of a bad answer without a second call, and saves nothing', async () => {
    const { client, requests } = scriptedClient([{ value: { scheda: 'troppo corta' } }]);
    expect(await generateCharacter(client, OPTIONS, [], deps().deps)).toEqual({
      error: 'La scheda generata non è valida, riprova.',
    });
    expect(requests).toHaveLength(1);
  });
});
