import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/archive/character';
import { mapIncomingId } from '../../../src/archive/ids';
import { planPack } from '../../../src/archive/planners/pack';
import { NOW_ISO, makeCharacter, makeDeps, stored } from './fixtures';

const idOf = (legacy: string): string => mapIncomingId(legacy, () => 'unused').id;

/** A character of a pack: a legacy id and a story, as `archpack.js` writes them. */
const packed = (legacyId: string, changes: Partial<Character> = {}): Character =>
  makeCharacter({
    id: legacyId,
    name: legacyId.toUpperCase(),
    sections: { storia: 'storia' },
    ...changes,
  });

describe('planPack, the skip rule (archui.js:209)', () => {
  it('adds a missing character as a first save with no reason and a mapped id', () => {
    const batch = planPack([], [[packed('c_a1')]], makeDeps());
    expect(batch).toEqual([
      {
        kind: 'versionedSave',
        expectedRevision: null,
        reason: null,
        character: expect.objectContaining({
          id: idOf('c_a1'),
          legacyId: 'c_a1',
          version: 1,
          revision: 1,
          updated: NOW_ISO,
        }) as Character,
      },
    ]);
  });

  it('skips a character whose id is already in the archive, mapped or not', () => {
    const live = makeCharacter({ id: idOf('c_a1') });
    expect(planPack([stored(live)], [[packed('c_a1')]], makeDeps())).toEqual([]);
  });

  it('skips a character whose name a living character with a story already has', () => {
    const same = makeCharacter({ name: 'c_á1', sections: { storia: 'x' } });
    expect(planPack([stored(same)], [[packed('c_a1')]], makeDeps())).toEqual([]);
  });

  it.each([
    ['is deceased', { status: 'deceduto' as const }],
    ['has no story', { sections: { carattere: 'x' } }],
    ['has an empty story', { sections: { storia: '' } }],
  ])('adds the character when the one with its name %s', (_case, changes) => {
    const same = makeCharacter({ name: 'C_A1', sections: { storia: 'x' }, ...changes });
    expect(planPack([stored(same)], [[packed('c_a1')]], makeDeps())).toHaveLength(1);
  });

  it('adds the character when the one with its name is deleted', () => {
    const gone = makeCharacter({ name: 'C_A1', sections: { storia: 'x' } });
    expect(planPack([stored(gone, true)], [[packed('c_a1')]], makeDeps())).toHaveLength(1);
  });
});

describe("planPack, the pack's own order", () => {
  it('counts the characters it adds itself: a second one with the same name is skipped', () => {
    const batch = planPack([], [[packed('c_a1')], [packed('c_a2', { name: 'C_A1' })]], makeDeps());
    expect(batch).toHaveLength(1);
  });
});

describe('planPack, a deleted character (FR-024)', () => {
  it('revives the archived row as a versioned save with the reason «pacchetto», keeping its id', () => {
    const archived = makeCharacter({ id: idOf('c_a1'), version: 4, revision: 9 });
    const [write, ...rest] = planPack([stored(archived, true)], [[packed('c_a1')]], makeDeps());
    expect(rest).toEqual([]);
    expect(write).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: 9,
      reason: 'pacchetto',
      character: {
        id: archived.id,
        legacyId: 'c_a1',
        name: 'C_A1',
        version: 4,
        revision: 9,
        updated: NOW_ISO,
      },
    });
  });
});

describe('planPack, ids and relations (FR-017)', () => {
  it('maps the relation targets with the same map as the ids', () => {
    const a = packed('c_a1', { relations: [{ to: 'c_a2', type: 'amici', int: 1, view: '' }] });
    const b = packed('c_a2');
    const [first] = planPack([], [[a, b]], makeDeps());
    expect(first).toMatchObject({ character: { relations: [{ to: idOf('c_a2') }] } });
  });

  it('keeps a character whose id is already a uuid, with no legacyId', () => {
    const uuid = '8f14e45f-ceea-467a-9575-4a1b1c9f0e11';
    const [write] = planPack([], [[packed(uuid)]], makeDeps());
    expect(write).toMatchObject({ character: { id: uuid } });
    expect(write).not.toHaveProperty('character.legacyId');
  });

  it('adds the characters of every pack, in order', () => {
    const batch = planPack([], [[packed('c_a1')], [packed('f_b1')]], makeDeps());
    expect(batch.map((w) => (w.kind === 'softDelete' ? w.id : w.character.legacyId))).toEqual([
      'c_a1',
      'f_b1',
    ]);
  });

  it('resolves pending relations that the pack makes possible, in place, in the same batch', () => {
    const holder = makeCharacter({
      revision: 2,
      pendingRelations: [{ name: 'c_a1', type: 'amici', int: 0, view: '' }],
    });
    const batch = planPack([stored(holder)], [[packed('c_a1')]], makeDeps());
    expect(batch[1]).toMatchObject({
      kind: 'inPlaceUpdate',
      expectedRevision: 2,
      character: { id: holder.id, relations: [{ to: idOf('c_a1') }], pendingRelations: [] },
    });
  });
});
