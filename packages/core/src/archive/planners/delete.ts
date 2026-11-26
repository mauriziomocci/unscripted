import type { Character } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import type { CharacterBatch, CharacterVersion, StoredCharacter } from '../../store/characterStore';
import { findLive } from './lookup';

/**
 * Plans the soft delete of a character (`archui.js:294`, FR-023): the delete
 * itself, then one in-place update for every other live character that pointed
 * to it, with that relation removed, all in one batch. The others get a fresh
 * `updated`, as the legacy save does (`archSave`, `archui.js:38`, `294`). Throws `CharacterNotFoundError`.
 */
export function planDelete(
  current: readonly StoredCharacter[],
  id: string,
  deps: ArchiveDeps,
): CharacterBatch {
  const stamp = nowIso(deps);
  const doomed = findLive(current, id);
  const cleanups = current.flatMap(({ character, archived }) => {
    const pointsToDoomed = (character.relations ?? []).some((relation) => relation.to === id);
    return !archived && character.id !== id && pointsToDoomed
      ? [withoutRelationTo(character, id, stamp)]
      : [];
  });
  return [
    { kind: 'softDelete', id, expectedRevision: doomed.revision },
    ...cleanups.map((character) => ({
      kind: 'inPlaceUpdate' as const,
      character,
      expectedRevision: character.revision,
    })),
  ];
}

function withoutRelationTo(character: Character, id: string, updated: string): Character {
  return {
    ...character,
    updated,
    relations: (character.relations ?? []).filter((relation) => relation.to !== id),
  };
}

/** What the confirmation «Si perdono N versioni e M rapporti» says (`archui.js:295`). */
export interface DeletionImpact {
  /** The history rows plus the current version. */
  readonly versions: number;
  /** The character's own relations. */
  readonly relations: number;
}

/** Counts what a delete loses, for the confirmation text; pure, so the UI shows exactly what the planner will remove. */
export function deletionImpact(
  character: Character,
  history: readonly CharacterVersion[],
): DeletionImpact {
  return { versions: history.length + 1, relations: character.relations?.length ?? 0 };
}
