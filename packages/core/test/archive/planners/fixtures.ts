import type { Character, CharacterSnapshot } from '../../../src/archive/character';
import type { ArchiveDeps } from '../../../src/archive/deps';
import type { StoredCharacter } from '../../../src/store/characterStore';

/** The instant every planner test runs at, as the injected clock reports it. */
export const NOW_MS = Date.parse('2026-11-27T09:30:00.000Z');
export const NOW_ISO = '2026-11-27T09:30:00.000Z';

/** The `updated` of characters that were stored earlier. */
export const EARLIER = '2026-11-20T08:00:00.000Z';

let counter = 0;

/** A stored character with the given changes; ids and names are unique within a test file. */
export function makeCharacter(changes: Partial<Character> = {}): Character {
  counter += 1;
  return {
    schema: 'personaggio/1',
    id: `id-${String(counter)}`,
    version: 1,
    revision: 1,
    updated: EARLIER,
    name: `Persona ${String(counter)}`,
    sex: 'm',
    age: 35,
    status: 'vivo',
    ...changes,
  };
}

/** The character as the history keeps it: everything but the store's revision. */
export function snapshotOf(character: Character): CharacterSnapshot {
  const snapshot: Record<string, unknown> = { ...character };
  delete snapshot.revision;
  return snapshot as CharacterSnapshot;
}

/** A character as a store lists it with `includeArchived`. */
export function stored(character: Character, archived = false): StoredCharacter {
  return { character, archived };
}

/** Deps with a frozen clock and ids `new-1`, `new-2`, ... in the order they are asked for. */
export function makeDeps(): ArchiveDeps {
  let issued = 0;
  return {
    clock: { now: () => NOW_MS, perfNow: () => 0 },
    newId: () => {
      issued += 1;
      return `new-${String(issued)}`;
    },
  };
}
