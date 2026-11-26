import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Character, CharacterInput } from '../../src/archive/character';
import { characterToMarkdown } from '../../src/archive/markdown';
import { PRESENT_PACK } from '../../src/index';
import { parseSheet } from './parseHelpers';

const FIXTURES = new URL('../fixtures/characters/presente/', import.meta.url);

/** The keys the Markdown sheet can carry (the same list as the fixtures' round trip). */
const REPRESENTED = ['name', 'age', 'sex', 'temper', 'short', 'sections', 'secrets', 'goals'];
const pick = (c: Partial<CharacterInput> | Character, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, c[key]]));

/** Every present-time fixture sheet parsed, keyed by the name its heading gives. */
const FIXTURE_SHEETS = new Map(
  readdirSync(FIXTURES)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const parsed = parseSheet(readFileSync(new URL(file, FIXTURES), 'utf8'), file);
      return [parsed.input.name, parsed.input] as const;
    }),
);

describe('the parser against the present pack (FR-015, FR-014)', () => {
  it.each(PRESENT_PACK.map((character) => [character.name, character] as const))(
    '%s keeps its markdown fields through serialize with secrets and parse',
    (_name, character) => {
      const text = characterToMarkdown(character, { withSecrets: true, nameOf: () => undefined });
      expect(pick(parseSheet(text).input, REPRESENTED)).toEqual(pick(character, REPRESENTED));
    },
  );

  it.each(PRESENT_PACK.map((character) => [character.name, character] as const))(
    'the fixture of %s parses to the name, sex and sections of the pack character',
    (name, character) => {
      const fixture = FIXTURE_SHEETS.get(name);
      expect(fixture).toBeDefined();
      expect(pick(fixture ?? {}, ['name', 'sex', 'sections'])).toEqual(
        pick(character, ['name', 'sex', 'sections']),
      );
    },
  );
});
