import { describe, expect, it } from 'vitest';
import type { CharacterInput } from '../../../src/archive/character';
import { NormaliseError } from '../../../src/archive/normalise';
import { CharacterNotFoundError, ArchiveRequestError } from '../../../src/archive/planners/errors';
import { planEdit } from '../../../src/archive/planners/edit';
import type { StoredCharacter } from '../../../src/store/characterStore';
import { NOW_ISO, makeCharacter, makeDeps, stored } from './fixtures';

const target = makeCharacter({ name: 'Ada Verdi', version: 3, revision: 5, legacyId: 'c_ada' });

const input = (changes: Partial<CharacterInput> = {}): CharacterInput => ({
  schema: 'personaggio/1',
  name: ' Ada Verdi ',
  sex: 'f',
  age: 500,
  status: 'vivo',
  ...changes,
});

const edit = (
  changes: Partial<CharacterInput>,
  mode: 'versioned' | 'inPlace',
  extra: StoredCharacter[] = [],
) =>
  planEdit([stored(target), ...extra], target.id, input(changes), 5, makeDeps(), {
    mode,
    symmetricRelations: false,
  });

describe('planEdit, versioned (archui.js:297-305)', () => {
  it('writes a versioned save over the stored revision with the reason «modifica manuale»', () => {
    const { batch, warnings } = edit({}, 'versioned');
    expect(warnings).toEqual([]);
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: 5,
      reason: 'modifica manuale',
      character: { id: target.id, legacyId: 'c_ada', version: 3, revision: 5, updated: NOW_ISO },
    });
  });

  it('applies the editor normalisations', () => {
    expect(edit({}, 'versioned').batch[0]).toMatchObject({
      character: { name: 'Ada Verdi', age: 95 },
    });
  });

  it('refuses an empty name with the typed error', () => {
    expect(() => edit({ name: '' }, 'versioned')).toThrow(NormaliseError);
  });

  it('takes the expected revision from the caller, not from the stored record', () => {
    const { batch } = planEdit([stored(target)], target.id, input(), 2, makeDeps(), {
      mode: 'versioned',
      symmetricRelations: false,
    });
    expect(batch[0]).toMatchObject({ expectedRevision: 2 });
  });
});

describe('planEdit, in place (P-03, FR-022)', () => {
  it('writes an in-place update with no reason and no normalisation', () => {
    const { batch } = edit({}, 'inPlace');
    expect(batch).toEqual([
      {
        kind: 'inPlaceUpdate',
        expectedRevision: 5,
        character: {
          ...input(),
          id: target.id,
          legacyId: 'c_ada',
          version: 3,
          revision: 5,
          updated: NOW_ISO,
        },
      },
    ]);
  });

  it('does not resolve pending relations', () => {
    const holder = makeCharacter({ pendingRelations: [{ name: 'Ada Verdi', type: 'amici' }] });
    expect(edit({}, 'inPlace', [stored(holder)]).batch).toHaveLength(1);
  });
});

describe('planEdit, refusals', () => {
  it('refuses an id in the input that is not the target', () => {
    const sent = { ...input(), id: 'someone-else' } as CharacterInput;
    expect(() => edit(sent, 'versioned')).toThrow(expect.objectContaining({ code: 'id_mismatch' }));
    expect(() => edit(sent, 'versioned')).toThrow(ArchiveRequestError);
  });

  it('accepts the target’s own id and drops it', () => {
    const sent = { ...input(), id: target.id, revision: 99 } as CharacterInput;
    expect(edit(sent, 'versioned').batch[0]).toMatchObject({
      character: { id: target.id, revision: 5 },
    });
  });

  it('refuses an unknown or archived target', () => {
    const deps = makeDeps();
    const options = { mode: 'versioned', symmetricRelations: false } as const;
    expect(() => planEdit([], 'nope', input(), 1, deps, options)).toThrow(CharacterNotFoundError);
    expect(() => planEdit([stored(target, true)], target.id, input(), 5, deps, options)).toThrow(
      CharacterNotFoundError,
    );
  });
});

const FRIEND = { to: 'friend', type: 'amici', int: 2, view: 'la stima' };

/** An edit that adds `relation` to the target, with `other` as the character it points to. */
function editWithRelation(
  other: StoredCharacter,
  relation: { to: string; type: string; int: number; view: string },
  before: (typeof FRIEND)[] = [],
) {
  const holder = makeCharacter({ ...target, relations: before });
  return planEdit(
    [stored(holder), other],
    holder.id,
    input({ age: 30, relations: [relation] }),
    5,
    makeDeps(),
    { mode: 'versioned', symmetricRelations: true },
  );
}

describe('planEdit, symmetric relations (archui.js:278, 304-306)', () => {
  it('writes the reciprocal relation on the other character as an in-place update in the same batch', () => {
    const friend = makeCharacter({ id: 'friend', name: 'Bea', revision: 2 });
    const { batch, warnings } = editWithRelation(stored(friend), FRIEND);
    expect(warnings).toEqual([]);
    expect(batch).toHaveLength(2);
    expect(batch[1]).toEqual({
      kind: 'inPlaceUpdate',
      expectedRevision: 2,
      character: {
        ...friend,
        updated: NOW_ISO,
        relations: [{ to: target.id, type: 'amici', int: 2, view: '' }],
      },
    });
  });

  it('writes nothing when the other character already points back with the same type', () => {
    const friend = makeCharacter({
      id: 'friend',
      relations: [{ to: target.id, type: 'amici', int: 0, view: '' }],
    });
    const { batch, warnings } = editWithRelation(stored(friend), FRIEND);
    expect(batch).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it('skips a relation whose target is not in the archive or is deleted', () => {
    const gone = makeCharacter({ id: 'friend' });
    expect(editWithRelation(stored(gone, true), FRIEND).batch).toHaveLength(1);
    expect(editWithRelation(stored(makeCharacter()), FRIEND).batch).toHaveLength(1);
  });
});

describe('planEdit, the relation_mismatch warning (archui.js:304-306)', () => {
  const friendBack = (type: string) =>
    stored(makeCharacter({ id: 'friend', relations: [{ to: target.id, type, int: 0, view: '' }] }));

  it('warns when a new relation has a different type from the one pointing back', () => {
    const { batch, warnings } = editWithRelation(friendBack('rivali'), FRIEND);
    expect(batch).toHaveLength(1);
    expect(warnings).toEqual([
      {
        code: 'relation_mismatch',
        characterId: target.id,
        otherId: 'friend',
        ownType: 'amici',
        otherType: 'rivali',
      },
    ]);
  });

  it('does not warn about a relation that was there before the edit', () => {
    expect(editWithRelation(friendBack('rivali'), FRIEND, [FRIEND]).warnings).toEqual([]);
  });

  it('refuses symmetric relations on an in-place edit with a typed error', () => {
    const attempt = () =>
      planEdit([stored(target)], target.id, input(), 5, makeDeps(), {
        mode: 'inPlace',
        symmetricRelations: true,
      });
    expect(attempt).toThrow(ArchiveRequestError);
    expect(attempt).toThrow(expect.objectContaining({ code: 'symmetric_in_place' }));
  });
});

describe('planEdit, the other holders of pending relations (P-03, archui.js:307)', () => {
  it('stamps the updated of a character whose pending relation stays unresolved', () => {
    const hal = makeCharacter({
      revision: 2,
      pendingRelations: [{ name: 'Nessuno', type: 'amici', int: 0, view: '' }],
    });
    const { batch } = edit({}, 'versioned', [stored(hal)]);
    expect(batch).toHaveLength(2);
    expect(batch[1]).toEqual({
      kind: 'inPlaceUpdate',
      expectedRevision: 2,
      character: { ...hal, updated: NOW_ISO },
    });
  });
});

describe('planEdit, pending relations of the edited character (archui.js:214, 306-307)', () => {
  it('links them after the symmetric loop, so the other side gets no back link', () => {
    const bea = makeCharacter({ id: 'friend', name: 'Bea', revision: 2 });
    const { batch } = planEdit(
      [stored(target), stored(bea)],
      target.id,
      input({ pendingRelations: [{ name: 'Bea', type: 'amici', int: 1, view: '' }] }),
      5,
      makeDeps(),
      { mode: 'versioned', symmetricRelations: true },
    );
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ character: { relations: [{ to: 'friend' }] } });
  });
});
