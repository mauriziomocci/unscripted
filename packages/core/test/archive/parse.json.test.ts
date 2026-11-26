import { describe, expect, it } from 'vitest';
import { parseCharacterFile } from '../../src/archive/parse';

/** The legacy messages, verbatim (`archui.js:57-59`). */
const INVALID_JSON = 'Il file JSON non è valido.';
const NO_NAME = 'Il JSON non contiene un personaggio (manca "name").';

describe('parseCharacterFile, the JSON branch (archui.js:56-60)', () => {
  it('reads a single character from a .json file, completed like a blank sheet', () => {
    const parsed = parseCharacterFile(JSON.stringify({ name: 'Ada', age: 41, sex: 'f' }), 'a.json');
    expect(parsed.error).toBeUndefined();
    expect(parsed.character).toMatchObject({ name: 'Ada', age: 41, sex: 'f', status: 'vivo' });
    expect(parsed.character.sections).toEqual({});
    expect(parsed.recognisedSections).toBe(0);
    expect(parsed.toOther).toBe(false);
  });

  it('takes a JSON text for JSON even when the file name says otherwise (`archui.js:55`)', () => {
    const parsed = parseCharacterFile('  {"name":"Bruno"}', 'scheda.md');
    expect(parsed.character.name).toBe('Bruno');
  });

  it('drops the keys the store owns and the inline history (`archui.js:58`)', () => {
    const { character } = parseCharacterFile(
      JSON.stringify({ name: 'Ada', id: 'c_1', version: 4, revision: 9, versions: [{ v: 1 }] }),
      'a.json',
    );
    expect(character).not.toHaveProperty('id');
    expect(character).not.toHaveProperty('version');
    expect(character).not.toHaveProperty('revision');
    expect(character).not.toHaveProperty('versions');
  });

  it('keeps the fields and the unknown keys of the file', () => {
    const { character } = parseCharacterFile(
      JSON.stringify({ name: 'Ada', secrets: ['uno'], novelty: 7, sections: { storia: 'x' } }),
      'a.json',
    );
    expect(character).toMatchObject({ secrets: ['uno'], novelty: 7, sections: { storia: 'x' } });
  });
});

describe('parseCharacterFile, the JSON branch refusals and limits (archui.js:56-60, 82)', () => {
  it('hands an archive file back untouched, to be imported and not edited (`archui.js:57`)', () => {
    const archive = { schema: 'archivio/1', chars: [{ name: 'Ada' }] };
    const parsed = parseCharacterFile(JSON.stringify(archive), 'archivio.json');
    expect(parsed.archive).toEqual(archive);
    expect(parsed.error).toBeUndefined();
  });

  it('refuses text that is not JSON', () => {
    expect(parseCharacterFile('{"name": ', 'a.json').error).toBe(INVALID_JSON);
    expect(parseCharacterFile('# Ada', 'a.json').error).toBe(INVALID_JSON);
  });

  it.each(['{}', '{"name":""}', '[]', 'null', '42', '{"nome":"Ada"}'])(
    'refuses %s: no name',
    (text) => {
      expect(parseCharacterFile(text, 'a.json').error).toBe(NO_NAME);
    },
  );

  it('refuses a record that is not a valid character, instead of passing it on', () => {
    expect(parseCharacterFile('{"name":"Ada","age":"old"}', 'a.json').error).toBe(INVALID_JSON);
  });

  it('refuses a prototype key anywhere in the file', () => {
    const text = '{"name":"Ada","sections":{"__proto__":{"polluted":true}}}';
    expect(parseCharacterFile(text, 'a.json').error).toBe(INVALID_JSON);
  });

  it('has no size limit, as in the legacy where the cap belongs to the Markdown branch (`archui.js:82`)', () => {
    const big = JSON.stringify({ name: 'Ada', short: 'a'.repeat(250000) });
    expect(parseCharacterFile(big, 'a.json').error).toBeUndefined();
  });
});
