import { describe, expect, it } from 'vitest';
import type { CharacterInput } from '../../src/archive/character';
import { NormaliseError, normaliseEdit } from '../../src/archive/normalise';

const SELF = 'id-self';

/** A valid present-time input; each test changes one thing. */
const base = (changes: Partial<CharacterInput> = {}): CharacterInput => ({
  schema: 'personaggio/1',
  name: 'Ada Verdi',
  sex: 'f',
  age: 41,
  status: 'vivo',
  ...changes,
});

const normalise = (changes: Partial<CharacterInput> = {}) => normaliseEdit(base(changes), SELF);

describe('normaliseEdit name (archui.js:297, 300)', () => {
  it('refuses an empty name with the legacy message and a typed error', () => {
    expect(() => normalise({ name: '   ' })).toThrow(NormaliseError);
    expect(() => normalise({ name: '' })).toThrow('Il nome è obbligatorio.');
  });

  it('refuses a name that is empty once the brackets are gone', () => {
    expect(() => normalise({ name: '<>' })).toThrow(NormaliseError);
  });

  it('tells the error apart by its code, not its text', () => {
    expect(() => normalise({ name: '' })).toThrow(
      expect.objectContaining({ code: 'name_required' }),
    );
  });

  it('trims the name and removes < and >', () => {
    expect(normalise({ name: '  <b>Ada</b> Verdi ' }).name).toBe('bAda/b Verdi');
  });
});

describe('normaliseEdit age (archui.js:297, AM2-06)', () => {
  it.each([
    ['present', 2, 3],
    ['present', 120, 95],
    ['present', 0, 35],
    ['futuro', 500, 95],
    ['romanzo', 500, 500],
    ['romanzo', 5000, 999],
    ['romanzo', 1, 3],
  ])('clamps a %s character aged %i to %i', (era, age, expected) => {
    expect(normalise({ era, age }).age).toBe(expected);
  });
});

describe('normaliseEdit text fields', () => {
  it('trims the sections, removes the empty ones and keeps unknown keys', () => {
    const { sections } = normalise({
      sections: { storia: '  una storia \n', carattere: '   ', paure: '', mia: 'extra' },
    });
    expect(sections).toEqual({ storia: 'una storia', mia: 'extra' });
  });

  it('writes secrets and goals one per line, trimmed, without empty lines', () => {
    const { secrets, goals } = normalise({
      secrets: ['  uno ', '', 'due\n\n tre  '],
      goals: ['\n', ' vincere '],
    });
    expect(secrets).toEqual(['uno', 'due', 'tre']);
    expect(goals).toEqual(['vincere']);
  });

  it('trims the short description', () => {
    expect(normalise({ short: '  Una frase.  ' }).short).toBe('Una frase.');
  });
});

describe('normaliseEdit relations (archui.js:299)', () => {
  it('turns an empty type into «conoscenti», trims the view and keeps the intensity', () => {
    const { relations } = normalise({
      relations: [{ to: 'id-a', type: '  ', int: 2, view: ' bene ' }],
    });
    expect(relations).toEqual([{ to: 'id-a', type: 'conoscenti', int: 2, view: 'bene' }]);
  });

  it('drops relations to the character itself and relations with no target', () => {
    const { relations } = normalise({
      relations: [
        { to: SELF, type: 'amici', int: 1, view: '' },
        { to: '', type: 'amici', int: 1, view: '' },
        { to: 'id-a', type: 'amici', int: 1, view: '' },
      ],
    });
    expect(relations?.map((relation) => relation.to)).toEqual(['id-a']);
  });
});

describe('normaliseEdit era, role and style (archui.js:297, AM-07, AM2-06)', () => {
  it('writes the era from the select: absent or unknown reads as present', () => {
    expect(normalise().era).toBe('presente');
    expect(normalise({ era: 'medioevo' }).era).toBe('presente');
    expect(normalise({ era: 'romanzo' }).era).toBe('romanzo');
  });

  it('keeps a future character’s role when it is one of the 8 keys and trims the style', () => {
    const result = normalise({ era: 'futuro', role: 'timoniere', style: '  <i>il pilota</i> ' });
    expect(result).toMatchObject({ era: 'futuro', role: 'timoniere', style: 'iil pilota/i' });
  });

  it('empties the role of a future character when it is not one of the 8 keys', () => {
    expect(normalise({ era: 'futuro', role: 'cuoco' }).role).toBe('');
    expect(normalise({ era: 'futuro' }).role).toBe('');
  });

  it.each(['presente', 'romanzo'])('deletes role and style of a %s character', (era) => {
    const result = normalise({ era, role: 'capitano', style: 'x' });
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('style');
  });
});

describe('normaliseEdit purity', () => {
  it('does not change its input and keeps every other key', () => {
    const input = base({ temper: 'calmo', tags: ['x'], extra: { deep: true } });
    const copy = structuredClone(input);
    const result = normaliseEdit(input, SELF);
    expect(input).toEqual(copy);
    expect(result).toMatchObject({ temper: 'calmo', tags: ['x'], extra: { deep: true } });
  });
});
