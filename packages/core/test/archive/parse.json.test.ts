import { describe, expect, it } from 'vitest';
import { parse, parseSheet } from './parseHelpers';

/** The legacy messages, verbatim (`archui.js:57-59`). */
const INVALID_JSON = 'Il file JSON non è valido.';
const NO_NAME = 'Il JSON non contiene un personaggio (manca "name").';

describe('parseCharacterFile, the JSON branch (archui.js:56-60)', () => {
  it('reads a single character from a .json file, completed like a blank sheet', () => {
    const parsed = parseSheet(JSON.stringify({ name: 'Ada', age: 41, sex: 'f' }), 'a.json');
    expect(parsed.input).toMatchObject({ name: 'Ada', age: 41, sex: 'f', status: 'vivo' });
    expect(parsed.input.sections).toEqual({});
    expect(parsed.recognisedSections).toBe(0);
    expect(parsed.otherSections).toBe(0);
  });

  it('takes a JSON text for JSON even when the file name says otherwise (`archui.js:55`)', () => {
    const parsed = parseSheet('  {"name":"Bruno"}', 'scheda.md');
    expect(parsed.input.name).toBe('Bruno');
  });

  it('drops the keys the store owns and the inline history (`archui.js:58`)', () => {
    const { input: character } = parseSheet(
      JSON.stringify({ name: 'Ada', id: 'c_1', version: 4, revision: 9, versions: [{ v: 1 }] }),
      'a.json',
    );
    expect(character).not.toHaveProperty('id');
    expect(character).not.toHaveProperty('version');
    expect(character).not.toHaveProperty('revision');
    expect(character).not.toHaveProperty('versions');
  });

  it('keeps the fields and the unknown keys of the file', () => {
    const { input: character } = parseSheet(
      JSON.stringify({ name: 'Ada', secrets: ['uno'], novelty: 7, sections: { storia: 'x' } }),
      'a.json',
    );
    expect(character).toMatchObject({ secrets: ['uno'], novelty: 7, sections: { storia: 'x' } });
  });
});

describe('parseCharacterFile, the JSON branch refusals and limits (archui.js:56-60, 82)', () => {
  it('hands an archive file back untouched, to be imported and not edited (`archui.js:57`)', () => {
    const archive = { schema: 'archivio/1', chars: [{ name: 'Ada' }] };
    expect(parse(JSON.stringify(archive), 'archivio.json')).toEqual({
      kind: 'archive',
      file: archive,
    });
  });

  it('refuses text that is not JSON', () => {
    expect(parse('{"name": ', 'a.json')).toEqual({ kind: 'error', error: INVALID_JSON });
    expect(parse('# Ada', 'a.json')).toEqual({ kind: 'error', error: INVALID_JSON });
  });

  it.each(['{}', '{"name":""}', '[]', 'null', '42', '{"nome":"Ada"}'])(
    'refuses %s: no name',
    (text) => {
      expect(parse(text, 'a.json')).toEqual({ kind: 'error', error: NO_NAME });
    },
  );

  it('refuses a record that is not a valid character, instead of passing it on', () => {
    expect(parse('{"name":"Ada","age":"old"}', 'a.json')).toEqual({
      kind: 'error',
      error: INVALID_JSON,
    });
  });

  it('refuses a prototype key anywhere in the file', () => {
    const text = '{"name":"Ada","sections":{"__proto__":{"polluted":true}}}';
    expect(parse(text, 'a.json')).toEqual({ kind: 'error', error: INVALID_JSON });
  });

  it('has no size limit, as in the legacy where the cap belongs to the Markdown branch (`archui.js:82`)', () => {
    const big = JSON.stringify({ name: 'Ada', short: 'a'.repeat(250000) });
    expect(parse(big, 'a.json').kind).toBe('character');
  });
});
