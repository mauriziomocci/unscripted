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
