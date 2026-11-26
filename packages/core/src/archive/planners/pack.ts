import type { Character } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import { withMappedIds } from '../ids';
import { normName } from '../normName';
import type { CharacterBatch, CharacterWrite, StoredCharacter } from '../../store/characterStore';
import { withPendingResolved } from './pending';

/** The reason stored when a pack character revives a deleted row (FR-024). */
const PACK_REASON = 'pacchetto';

/** The legacy skip rule (`archui.js:209`): the id is taken, or a living character with a story has the name. */
function isAlreadyThere(live: readonly Character[], packed: Character): boolean {
  return live.some(
    (other) =>
      other.id === packed.id ||
      (normName(other.name) === normName(packed.name) &&
        other.status !== 'deceduto' &&
        Boolean(other.sections?.storia)),
  );
}

/**
 * Plans the addition of ready-made characters (`archui.js:209`, FR-024).
 * Each is skipped by the legacy rule, with ids and relation targets mapped
 * like an import's (FR-017); the others are added as first saves with no
 * reason, or, when a deleted row has the id, as a versioned save over it with
 * the reason «pacchetto». The characters added count for the skip rule of
 * the ones after them, as in the legacy loop. Pending relations the new
 * names resolve follow in the same batch.
 */
export function planPack(
  current: readonly StoredCharacter[],
  packs: readonly (readonly Character[])[],
  deps: ArchiveDeps,
): CharacterBatch {
  const stamp = nowIso(deps);
  const live = current.filter((row) => !row.archived).map((row) => row.character);
  const archived = new Map(
    current.filter((row) => row.archived).map((row) => [row.character.id, row.character]),
  );
  const writes: CharacterWrite[] = [];
  for (const packed of packs.flat().map((character) => withMappedIds(character, deps.newId))) {
    if (isAlreadyThere(live, packed)) continue;
    const old = archived.get(packed.id);
    const character: Character = old
      ? { ...packed, version: old.version, revision: old.revision, updated: stamp }
      : { ...packed, revision: 1, updated: stamp };
    live.push(character);
    writes.push({
      kind: 'versionedSave',
      character,
      expectedRevision: old?.revision ?? null,
      reason: old ? PACK_REASON : null,
    });
  }
  return withPendingResolved(current, writes, stamp);
}
