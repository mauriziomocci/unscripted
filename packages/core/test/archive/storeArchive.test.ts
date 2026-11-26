import { describeArchiveClient } from '../../testing/archiveClientSuite';
import { createMemoryCharacterStore } from '../../testing/memoryCharacterStore';
import { StoreArchive } from '../../src/archive/storeArchive';
import type { Character } from '../../src/archive/character';

const PACK_IDS = ['pack-ada', 'pack-bruno'] as const;

/** A ready-made character the way a pack carries it. */
function packed(id: string, name: string): Character {
  return {
    schema: 'personaggio/1',
    id,
    version: 1,
    revision: 1,
    updated: '2026-01-01T00:00:00.000Z',
    name,
    sex: 'f',
    age: 30,
    status: 'vivo',
    sections: { storia: `La storia di ${name}.` },
  };
}

let issued = 0;

describeArchiveClient('StoreArchive over the in-memory store', () => {
  return new StoreArchive(createMemoryCharacterStore(), {
    clock: { now: () => Date.parse('2026-11-27T09:30:00.000Z'), perfNow: () => 0 },
    newId: () => {
      issued += 1;
      return `00000000-0000-4000-8000-${String(issued).padStart(12, '0')}`;
    },
    packs: [PACK_IDS.map((id) => packed(id, id))],
  });
});
