import { describe, expect, it } from 'vitest';
import type { CharacterInput } from '../../../src/archive/character';
import { NormaliseError } from '../../../src/archive/normalise';
import { planCreate } from '../../../src/archive/planners/create';
import { NOW_ISO, makeCharacter, makeDeps, stored } from './fixtures';

const OPTIONS = { symmetricRelations: false };

const input = (changes: Partial<CharacterInput> = {}): CharacterInput => ({
  schema: 'personaggio/1',
  name: 'Ada Verdi',
  sex: 'f',
  age: 41,
  status: 'vivo',
  ...changes,
});

describe('planCreate (archui.js:297-307, P-03)', () => {
  it('writes one first save: no expected revision, version 1, no reason, a fresh id and the clock', () => {
    const { batch, warnings } = planCreate([], input(), makeDeps(), OPTIONS);
    expect(warnings).toEqual([]);
    expect(batch).toEqual([
      {
        kind: 'versionedSave',
        expectedRevision: null,
        reason: null,
        character: {
          ...input(),
          id: 'new-1',
          version: 1,
          revision: 1,
          updated: NOW_ISO,
          era: 'presente',
          origin: { label: "creato nell'archivio · 27/11" },
          short: '',
          sections: {},
          secrets: [],
          goals: [],
          relations: [],
        },
      },
    ]);
  });

  it('applies the editor normalisations', () => {
    const { batch } = planCreate(
      [],
      input({ name: ' <Ada> ', age: 500, secrets: [' a ', ''] }),
      makeDeps(),
      OPTIONS,
    );
    expect(batch[0]).toMatchObject({ character: { name: 'Ada', age: 95, secrets: ['a'] } });
  });
});

describe('planCreate, the origin label (archui.js:62, 205)', () => {
  it('keeps the origin a sheet read from a file already has', () => {
    const origin = { label: 'importato da ada.md · 26/11' };
    const { batch } = planCreate([], input({ origin }), makeDeps(), OPTIONS);
    expect(batch[0]).toMatchObject({ character: { origin } });
  });
});

describe('planCreate, input rules', () => {
  it('refuses an empty name with the typed error and plans nothing', () => {
    expect(() => planCreate([], input({ name: ' ' }), makeDeps(), OPTIONS)).toThrow(NormaliseError);
  });

  it('ignores the keys the store owns when a client sends them', () => {
    const sent = {
      ...input(),
      id: 'mine',
      legacyId: 'c_x',
      version: 9,
      revision: 9,
    } as CharacterInput;
    const { batch } = planCreate([], sent, makeDeps(), OPTIONS);
    expect(batch[0]).toMatchObject({ character: { id: 'new-1', version: 1, revision: 1 } });
    expect(batch[0]).not.toHaveProperty('character.legacyId');
  });
});

describe('planCreate, ids and pending relations', () => {
  it('asks for exactly one id', () => {
    const deps = makeDeps();
    planCreate([], input(), deps, OPTIONS);
    expect(deps.newId()).toBe('new-2');
  });

  it('resolves, in the same batch, the pending relations of others that name the new character', () => {
    const holder = makeCharacter({
      revision: 3,
      pendingRelations: [{ name: 'ada verdi', type: 'amici', int: 1, view: '' }],
    });
    const { batch } = planCreate([stored(holder)], input(), makeDeps(), OPTIONS);
    expect(batch).toHaveLength(2);
    expect(batch[1]).toMatchObject({
      kind: 'inPlaceUpdate',
      expectedRevision: 3,
      character: {
        id: holder.id,
        relations: [{ to: 'new-1' }],
        pendingRelations: [],
        updated: NOW_ISO,
      },
    });
  });

  it('resolves the new character’s own pending relations inside its save', () => {
    const bea = makeCharacter({ name: 'Bea Rossi' });
    const sent = input({
      pendingRelations: [{ name: 'Bea Rossi', type: 'amici', int: 0, view: '' }],
    });
    const { batch } = planCreate([stored(bea)], sent, makeDeps(), OPTIONS);
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      character: { relations: [{ to: bea.id }], pendingRelations: [] },
    });
  });
});

describe('planCreate, symmetric relations (archui.js:304)', () => {
  it('writes the reciprocal relation on the other character, which points to the new id', () => {
    const friend = makeCharacter({ id: 'friend', revision: 2 });
    const sent = input({ relations: [{ to: 'friend', type: 'amici', int: 1, view: 'x' }] });
    const { batch, warnings } = planCreate([stored(friend)], sent, makeDeps(), {
      symmetricRelations: true,
    });
    expect(warnings).toEqual([]);
    expect(batch[1]).toMatchObject({
      kind: 'inPlaceUpdate',
      expectedRevision: 2,
      character: { id: 'friend', relations: [{ to: 'new-1', type: 'amici', int: 1, view: '' }] },
    });
  });

  it('warns when the other character already points back with another type', () => {
    const friend = makeCharacter({
      id: 'friend',
      relations: [{ to: 'new-1', type: 'rivali', int: 0, view: '' }],
    });
    const sent = input({ relations: [{ to: 'friend', type: 'amici', int: 1, view: '' }] });
    const { warnings } = planCreate([stored(friend)], sent, makeDeps(), {
      symmetricRelations: true,
    });
    expect(warnings).toMatchObject([
      { characterId: 'new-1', otherId: 'friend', ownType: 'amici', otherType: 'rivali' },
    ]);
  });
});

describe('planCreate, a sheet read from a file (archui.js:250-251, 306)', () => {
  it('links the people its Rapporti name, and the symmetric save links them back without a warning', () => {
    const bea = makeCharacter({ name: 'Bea', revision: 3 });
    const sent = input({
      name: 'Ugo',
      pendingRelations: [{ name: 'Bea', type: 'amici', int: 2, view: 'bella' }],
    });
    const { batch, warnings } = planCreate([stored(bea)], sent, makeDeps(), {
      symmetricRelations: true,
    });
    expect(warnings).toEqual([]);
    expect(batch).toHaveLength(2);
    expect(batch[0]).toMatchObject({
      character: {
        relations: [{ to: bea.id, type: 'amici', int: 2, view: 'bella' }],
        pendingRelations: [],
      },
    });
    expect(batch[1]).toMatchObject({
      kind: 'inPlaceUpdate',
      expectedRevision: 3,
      character: { id: bea.id, relations: [{ to: 'new-1', type: 'amici', int: 2, view: '' }] },
    });
  });
});
