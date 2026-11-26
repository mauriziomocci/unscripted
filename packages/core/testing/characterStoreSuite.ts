import { describe, expect, it } from 'vitest';
import type { Character } from '../src/archive/character';
import { StaleWriteError } from '../src/store/errors';
import type { CharacterStore } from '../src/store/characterStore';

/** Builds a fresh, empty store for one test; a real store truncates its tables here. */
export type CharacterStoreFactory = () => CharacterStore | Promise<CharacterStore>;

const FIRST_SAVE_AT = '2026-11-20T08:00:00.000Z';

let counter = 0;

/** A character as a planner hands it over, ids and names unique across the suite. */
function makeCharacter(changes: Partial<Character> = {}): Character {
  counter += 1;
  return {
    schema: 'personaggio/1',
    id: `store-suite-${String(counter)}`,
    version: 1,
    revision: 1,
    updated: FIRST_SAVE_AT,
    name: `Persona ${String(counter)}`,
    sex: 'm',
    age: 35,
    status: 'vivo',
    ...changes,
  };
}

/** Stores the character as a first save and returns it as the planners hand it over. */
async function firstSave(store: CharacterStore, changes: Partial<Character> = {}) {
  const character = makeCharacter(changes);
  await store.apply([{ kind: 'versionedSave', character, expectedRevision: null, reason: null }]);
  return character;
}

/** The operation fails with a `StaleWriteError`, naming `id` when given. */
async function expectStale(operation: Promise<unknown>, id?: string): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(StaleWriteError);
  if (id !== undefined) await expect(operation).rejects.toMatchObject({ id });
}

function describeAtomicApply(factory: CharacterStoreFactory): void {
  it('stores nothing of a batch whose last write fails', async () => {
    const store = await factory();
    const kept = await firstSave(store);
    const added = makeCharacter();
    await expectStale(
      store.apply([
        { kind: 'versionedSave', character: added, expectedRevision: null, reason: null },
        { kind: 'inPlaceUpdate', character: { ...kept, name: 'Cambiato' }, expectedRevision: 99 },
      ]),
      kept.id,
    );
    expect(await store.get(added.id)).toBeNull();
    expect((await store.get(kept.id))?.name).toBe(kept.name);
  });

  it('lets a later write of a batch see the revision an earlier one produced', async () => {
    const store = await factory();
    const character = await firstSave(store);
    await store.apply([
      { kind: 'inPlaceUpdate', character: { ...character, age: 40 }, expectedRevision: 1 },
      { kind: 'inPlaceUpdate', character: { ...character, age: 41 }, expectedRevision: 2 },
    ]);
    expect(await store.get(character.id)).toMatchObject({ age: 41, revision: 3 });
  });
}

function describeRevisions(factory: CharacterStoreFactory): void {
  it('refuses a stale revision, also after an in-place update', async () => {
    const store = await factory();
    const character = await firstSave(store);
    await store.apply([
      { kind: 'inPlaceUpdate', character: { ...character, age: 36 }, expectedRevision: 1 },
    ]);
    await expectStale(
      store.apply([
        { kind: 'inPlaceUpdate', character: { ...character, age: 37 }, expectedRevision: 1 },
      ]),
      character.id,
    );
    await store.apply([
      { kind: 'inPlaceUpdate', character: { ...character, age: 38 }, expectedRevision: 2 },
    ]);
    expect(await store.get(character.id)).toMatchObject({ age: 38, revision: 3, version: 1 });
  });

  it('bumps version and revision on a versioned save', async () => {
    const store = await factory();
    const character = await firstSave(store);
    await store.apply([
      {
        kind: 'versionedSave',
        character: { ...character, name: 'Nuovo' },
        expectedRevision: 1,
        reason: 'modifica manuale',
      },
    ]);
    expect(await store.get(character.id)).toMatchObject({ name: 'Nuovo', version: 2, revision: 2 });
  });
}

function describeFirstSaveConflicts(factory: CharacterStoreFactory): void {
  it('refuses a first save over an existing id', async () => {
    const store = await factory();
    const character = await firstSave(store);
    await expectStale(
      store.apply([{ kind: 'versionedSave', character, expectedRevision: null, reason: null }]),
      character.id,
    );
  });

  it('refuses a first save over an archived id', async () => {
    const store = await factory();
    const character = await firstSave(store);
    await store.apply([{ kind: 'softDelete', id: character.id, expectedRevision: 1 }]);
    await expectStale(
      store.apply([{ kind: 'versionedSave', character, expectedRevision: null, reason: null }]),
      character.id,
    );
  });
}

function describeListing(factory: CharacterStoreFactory): void {
  it('hides a soft-deleted character from get and list, and shows it with includeArchived', async () => {
    const store = await factory();
    const gone = await firstSave(store);
    const kept = await firstSave(store);
    await store.apply([{ kind: 'softDelete', id: gone.id, expectedRevision: 1 }]);
    expect(await store.get(gone.id)).toBeNull();
    expect((await store.list()).map(({ id }) => id)).toEqual([kept.id]);
    const all = await store.list({ includeArchived: true });
    expect(all.map(({ character, archived }) => [character.id, archived])).toEqual([
      [gone.id, true],
      [kept.id, false],
    ]);
  });

  it('lists in the order of the first save, whatever was written since', async () => {
    const store = await factory();
    const first = await firstSave(store);
    const second = await firstSave(store);
    const third = await firstSave(store);
    await store.apply([
      { kind: 'inPlaceUpdate', character: { ...first, age: 50 }, expectedRevision: 1 },
      {
        kind: 'versionedSave',
        character: { ...second, name: 'Dopo' },
        expectedRevision: 1,
        reason: 'modifica manuale',
      },
    ]);
    expect((await store.list()).map(({ id }) => id)).toEqual([first.id, second.id, third.id]);
  });

  it('answers null for an id it never saw', async () => {
    expect(await (await factory()).get('missing')).toBeNull();
  });
}

/**
 * The contract of a `CharacterStore` (FR-050): the same assertions run on the
 * in-memory double, `PgCharacterStore` and `IndexedDbStore`, which is what
 * keeps the two forms of the game equal (P-03). The factory returns an empty
 * store each time it is called.
 */
export function describeCharacterStore(name: string, factory: CharacterStoreFactory): void {
  describe(`CharacterStore: ${name}`, () => {
    describe('atomic apply', () => {
      describeAtomicApply(factory);
    });
    describe('revisions', () => {
      describeRevisions(factory);
    });
    describe('first saves', () => {
      describeFirstSaveConflicts(factory);
    });
    describe('listing', () => {
      describeListing(factory);
    });
  });
}
