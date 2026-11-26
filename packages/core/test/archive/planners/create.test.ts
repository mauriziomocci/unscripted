import { describe, expect, it } from 'vitest';
import type { CharacterInput } from '../../../src/archive/character';
import { NormaliseError } from '../../../src/archive/normalise';
import { planCreate } from '../../../src/archive/planners/create';
import { NOW_ISO, makeCharacter, makeDeps, stored } from './fixtures';

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
    const { batch, warnings } = planCreate([], input(), makeDeps());
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
    );
    expect(batch[0]).toMatchObject({ character: { name: 'Ada', age: 95, secrets: ['a'] } });
  });
});

describe('planCreate, input rules', () => {
  it('refuses an empty name with the typed error and plans nothing', () => {
    expect(() => planCreate([], input({ name: ' ' }), makeDeps())).toThrow(NormaliseError);
  });

  it('ignores the keys the store owns when a client sends them', () => {
    const sent = {
      ...input(),
      id: 'mine',
      legacyId: 'c_x',
      version: 9,
      revision: 9,
    } as CharacterInput;
    const { batch } = planCreate([], sent, makeDeps());
    expect(batch[0]).toMatchObject({ character: { id: 'new-1', version: 1, revision: 1 } });
    expect(batch[0]).not.toHaveProperty('character.legacyId');
  });
});

describe('planCreate, ids and pending relations', () => {
  it('asks for exactly one id', () => {
    const deps = makeDeps();
    planCreate([], input(), deps);
    expect(deps.newId()).toBe('new-2');
  });

  it('resolves, in the same batch, the pending relations of others that name the new character', () => {
    const holder = makeCharacter({
      revision: 3,
      pendingRelations: [{ name: 'ada verdi', type: 'amici', int: 1, view: '' }],
    });
    const { batch } = planCreate([stored(holder)], input(), makeDeps());
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
    const { batch } = planCreate([stored(bea)], sent, makeDeps());
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      character: { relations: [{ to: bea.id }], pendingRelations: [] },
    });
  });
});
