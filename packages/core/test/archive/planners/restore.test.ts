import { describe, expect, it } from 'vitest';
import { CharacterNotFoundError, VersionNotFoundError } from '../../../src/archive/planners/errors';
import { planRestore } from '../../../src/archive/planners/restore';
import type { CharacterVersion } from '../../../src/store/characterStore';
import { EARLIER, NOW_ISO, makeCharacter, makeDeps, snapshotOf, stored } from './fixtures';

const current = makeCharacter({
  name: 'Ada Nuova',
  version: 3,
  revision: 7,
  legacyId: 'c_ada',
  sections: { storia: 'testo nuovo' },
});

/** The history of `current`: versions 1 and 2, as a store lists it (newest first). */
function historyOf(): CharacterVersion[] {
  const snapshot = snapshotOf({
    ...current,
    name: 'Ada Vecchia',
    sections: { storia: 'testo vecchio' },
  });
  return [
    { version: 2, at: EARLIER, reason: 'modifica manuale', data: { ...snapshot, version: 2 } },
    {
      version: 1,
      at: EARLIER,
      reason: null,
      data: { ...snapshot, version: 1, name: 'Ada Primissima' },
    },
  ];
}

const restore = (version: number, expectedRevision = 7) =>
  planRestore([stored(current)], historyOf(), current.id, version, expectedRevision, makeDeps());

describe('planRestore (archui.js:293)', () => {
  it('writes a versioned save whose data is the chosen snapshot and whose reason is «ripristino vN»', () => {
    const [write, ...rest] = restore(2);
    expect(rest).toEqual([]);
    expect(write).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: 7,
      reason: 'ripristino v2',
      character: {
        id: current.id,
        legacyId: 'c_ada',
        name: 'Ada Vecchia',
        sections: { storia: 'testo vecchio' },
        updated: NOW_ISO,
      },
    });
  });

  it('keeps the version and revision the character had, which the store bumps', () => {
    expect(restore(1)[0]).toMatchObject({
      reason: 'ripristino v1',
      character: { name: 'Ada Primissima', version: 3, revision: 7 },
    });
  });

  it('takes the expected revision from the caller', () => {
    expect(restore(2, 4)[0]).toMatchObject({ expectedRevision: 4 });
  });

  it('refuses a version the history does not hold with a typed error', () => {
    expect(() => restore(9)).toThrow(VersionNotFoundError);
    expect(() => restore(9)).toThrow(expect.objectContaining({ id: current.id, version: 9 }));
  });

  it('refuses an unknown or deleted character', () => {
    const deps = makeDeps();
    expect(() => planRestore([], historyOf(), current.id, 2, 7, deps)).toThrow(
      CharacterNotFoundError,
    );
    expect(() => planRestore([stored(current, true)], historyOf(), current.id, 2, 7, deps)).toThrow(
      CharacterNotFoundError,
    );
  });
});
