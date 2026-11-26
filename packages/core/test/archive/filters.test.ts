import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/archive/character';
import {
  countByEra,
  countByStatus,
  duplicateNameIds,
  filterByStatus,
  searchArchive,
} from '../../src/archive/filters';

let counter = 0;
/** A stored character with the given changes; ids are unique within a test file. */
function character(changes: Partial<Character> = {}): Character {
  counter += 1;
  return {
    schema: 'personaggio/1',
    id: `id-${String(counter)}`,
    version: 1,
    revision: 1,
    updated: '2026-11-26T10:00:00.000Z',
    name: `Persona ${String(counter)}`,
    sex: 'm',
    age: 35,
    status: 'vivo',
    ...changes,
  };
}

const ALIVE = character({ name: 'Viva' });
const DECEASED = character({ name: 'Morta', status: 'deceduto' });
const OFF = character({ name: 'Spenta', disabled: true });
const OFF_AND_DECEASED = character({ name: 'Spenta e morta', disabled: true, status: 'deceduto' });
const ALL = [ALIVE, DECEASED, OFF, OFF_AND_DECEASED];
const names = (list: readonly Character[]): string[] => list.map((c) => c.name);

describe('filterByStatus (archui.js:232)', () => {
  it('vivi: not disabled and not deceased', () => {
    expect(names(filterByStatus(ALL, 'vivi'))).toEqual(['Viva']);
  });

  it('deceduti: deceased and not disabled', () => {
    expect(names(filterByStatus(ALL, 'deceduti'))).toEqual(['Morta']);
  });

  it('disattivati: disabled, deceased or not', () => {
    expect(names(filterByStatus(ALL, 'disattivati'))).toEqual(['Spenta', 'Spenta e morta']);
  });

  it('tutti: every character', () => {
    expect(names(filterByStatus(ALL, 'tutti'))).toEqual(names(ALL));
  });
});

describe('countByStatus (archui.js:231)', () => {
  it('counts alive as everything minus the deceased, so disabled characters are in it', () => {
    expect(countByStatus(ALL)).toEqual({ alive: 2, deceased: 2, disabled: 2 });
  });

  it('is not the partition of the filters: «vivi» lists one, the counter says two', () => {
    expect(filterByStatus(ALL, 'vivi')).toHaveLength(1);
    expect(countByStatus(ALL).alive).toBe(2);
  });
});

describe('countByEra (talk.js:37-38)', () => {
  it('counts the characters that are neither disabled nor deceased, by era', () => {
    const list = [
      character(),
      character({ era: 'medioevo' }),
      character({ era: 'futuro' }),
      character({ era: 'romanzo' }),
      character({ era: 'romanzo', disabled: true }),
      character({ era: 'futuro', status: 'deceduto' }),
    ];
    expect(countByEra(list)).toEqual({ present: 2, future: 1, novel: 1 });
  });
});

describe('searchArchive (archui.js:233)', () => {
  const ADA = character({
    name: 'Ada Verdi',
    era: 'futuro',
    style: 'il veterano',
    tags: ['pilota'],
  });
  const ELIA = character({ name: 'Èlia Neri', short: 'Una Frase Lunga' });
  const BEA = character({ name: 'bea Rossi', era: 'futuro' });
  const list = [BEA, ADA, ELIA];

  it('keeps the characters of the era and sorts them by name', () => {
    expect(names(searchArchive(list, 'futuro', ''))).toEqual(['Ada Verdi', 'bea Rossi']);
  });

  it('reads an era that is not futuro or romanzo as present', () => {
    expect(names(searchArchive(list, 'presente', ''))).toEqual(['Èlia Neri']);
  });

  it.each([
    ['ELIA', 'Èlia Neri'],
    ['frase lunga', 'Èlia Neri'],
    ['VETERANO', 'Ada Verdi'],
    ['pilota', 'Ada Verdi'],
    ['verdi  il veterano', 'Ada Verdi'],
  ])('matches «%s» on name, short, style and tags, folding accents and case', (query, name) => {
    const hit = list.find((c) => c.name === name);
    expect(names(searchArchive(list, hit?.era ?? 'presente', query))).toEqual([name]);
  });

  it('finds nothing for a text that is not there', () => {
    expect(searchArchive(list, 'futuro', 'zzz')).toEqual([]);
  });

  it('does not change the list it is given', () => {
    const before = [...list];
    searchArchive(list, 'futuro', '');
    expect(list).toEqual(before);
  });
});

describe('duplicateNameIds (archui.js:237)', () => {
  it('marks every character whose normalised name another character has', () => {
    const one = character({ name: 'Anna  Rossi' });
    const two = character({ name: 'ànna rossi' });
    const other = character({ name: 'Anna Verdi' });
    expect(duplicateNameIds([one, two, other])).toEqual(new Set([one.id, two.id]));
  });

  it('marks nothing when every name is different', () => {
    expect(duplicateNameIds(ALL).size).toBe(0);
  });
});
