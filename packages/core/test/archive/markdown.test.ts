import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CharacterInput } from '../../src/archive/character';
import { characterToMarkdown } from '../../src/archive/markdown';
import { parseCharacterFile } from '../../src/archive/parse';

const FIXTURES = new URL('../fixtures/characters/presente/', import.meta.url);

const NAMES: Readonly<Record<string, string>> = { 'id-bea': 'Bea Rossi', 'id-carlo': 'Carlo Neri' };
const nameOf = (id: string): string | undefined => NAMES[id];

/** A future character with every markdown-representable key. */
const ADA: CharacterInput = {
  schema: 'personaggio/1',
  name: 'Ada Verdi',
  sex: 'f',
  age: 41,
  temper: 'ironico',
  era: 'futuro',
  role: 'capitano',
  style: 'il veterano',
  short: 'Una frase.',
  sections: { identita: 'Aspetto.', storia: 'Storia.', altro: 'Note.' },
  secrets: ['primo segreto', 'secondo segreto'],
  goals: ['vincere'],
  relations: [
    { to: 'id-bea', type: 'amici', int: 2, view: 'la stima' },
    { to: 'id-carlo', type: 'rivali', int: 0, view: '' },
    { to: 'id-gone', type: 'amici', int: 1, view: 'sparita' },
  ],
  status: 'vivo',
};

const ADA_WITH_SECRETS = `# Ada Verdi
Età: 41
Sesso: donna
Temperamento: ironico
Epoca: futuro
Ruolo preferito: capitano
Stile: il veterano
In breve: Una frase.

## Identità e aspetto
Aspetto.

## Storia di vita
Storia.

## Segreti
- primo segreto
- secondo segreto

## Obiettivi
- vincere

## Rapporti
- Bea Rossi: amici, 2, "la stima"
- Carlo Neri: rivali, 0

## Altro
Note.
`;

describe('characterToMarkdown (archui.js:127-136)', () => {
  it('writes the legacy format, secrets and goals included', () => {
    expect(characterToMarkdown(ADA, { withSecrets: true, nameOf })).toBe(ADA_WITH_SECRETS);
  });

  it('omits secrets and goals when told to', () => {
    const text = characterToMarkdown(ADA, { withSecrets: false, nameOf });
    expect(text).not.toContain('## Segreti');
    expect(text).not.toContain('## Obiettivi');
    expect(text).toContain('## Rapporti');
  });

  it('omits the relations when it cannot name their targets', () => {
    expect(characterToMarkdown(ADA, { withSecrets: true })).not.toContain('## Rapporti');
  });

  it('writes Epoca for novel characters and Ruolo and Stile for future ones only', () => {
    const novel = characterToMarkdown({ ...ADA, era: 'romanzo' }, { withSecrets: false });
    expect(novel).toContain('Epoca: romanzo');
    expect(novel).not.toContain('Ruolo preferito');
    const present = characterToMarkdown({ ...ADA, era: 'presente' }, { withSecrets: false });
    expect(present).not.toContain('Epoca');
    expect(present).not.toContain('Stile');
  });
});

const REPRESENTED = ['name', 'age', 'sex', 'temper', 'short', 'sections', 'secrets', 'goals'];
const pick = (c: CharacterInput, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, c[key]]));

describe('the markdown round trip of the fixtures', () => {
  it.each(readdirSync(FIXTURES).filter((name) => name.endsWith('.md')))(
    '%s survives parse, serialize with secrets, parse',
    (file) => {
      const first = parseCharacterFile(readFileSync(new URL(file, FIXTURES), 'utf8'), file);
      const text = characterToMarkdown(first.character, { withSecrets: true });
      const second = parseCharacterFile(text, file);
      expect(pick(second.character, REPRESENTED)).toEqual(pick(first.character, REPRESENTED));
    },
  );
});

describe('the markdown round trip of the era keys', () => {
  it('keeps the era, the role and the style of a future character', () => {
    const text = characterToMarkdown(ADA, { withSecrets: true, nameOf });
    const back = parseCharacterFile(text, 'ada.md').character;
    expect(pick(back, ['era', 'role', 'style'])).toEqual({
      era: 'futuro',
      role: 'capitano',
      style: 'il veterano',
    });
  });

  it('keeps the era of a novel character', () => {
    const text = characterToMarkdown({ ...ADA, era: 'romanzo' }, { withSecrets: true });
    expect(parseCharacterFile(text, 'ada.md').character.era).toBe('romanzo');
  });

  it('brings a novel character aged 120 back aged 95, the legacy defect of archui.js:70 (FR-014, AM2-06)', () => {
    const text = characterToMarkdown({ ...ADA, era: 'romanzo', age: 120 }, { withSecrets: true });
    expect(text).toContain('Età: 120');
    expect(parseCharacterFile(text, 'ada.md').character.age).toBe(95);
  });
});
