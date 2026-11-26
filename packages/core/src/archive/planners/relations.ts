import type { Character } from '../character';
import type { ArchiveWarning, CharacterWrite, StoredCharacter } from '../../store/characterStore';
import type { CharacterInput } from '../character';
import { omitKeys } from './input';
import { resolveOne, withPendingResolved } from './pending';
import type { PlannedBatch } from './types';

type Relation = NonNullable<Character['relations']>[number];

/** The link the other side gets: same type and intensity, no opinion of its own (`archui.js:306`). */
function reciprocalOf(character: Character, relation: Relation): Relation {
  return { to: character.id, type: relation.type, int: relation.int ?? 0, view: '' };
}

/**
 * The reciprocal side of the relations a save wrote (`archui.js:304-306`): a
 * character that does not point back gets the link as an in-place update; one
 * that points back with another type is left alone, and a relation that is new
 * in this save raises `relation_mismatch`. Targets that are not in the archive
 * are skipped.
 */
function symmetricWrites(
  current: readonly StoredCharacter[],
  character: Character,
  before: readonly Relation[],
  stamp: string,
): { writes: CharacterWrite[]; warnings: ArchiveWarning[] } {
  const live = new Map(
    current.filter((s) => !s.archived).map((s) => [s.character.id, s.character]),
  );
  const changed = new Map<string, Character>();
  const warnings: ArchiveWarning[] = [];
  for (const relation of character.relations ?? []) {
    const other = changed.get(relation.to) ?? live.get(relation.to);
    if (!other) continue;
    const back = other.relations?.find((link) => link.to === character.id);
    if (!back) {
      const relations = [...(other.relations ?? []), reciprocalOf(character, relation)];
      changed.set(other.id, { ...other, relations, updated: stamp });
    } else if (back.type !== relation.type && !before.some((old) => old.to === relation.to)) {
      const { id: characterId } = character;
      warnings.push({
        code: 'relation_mismatch',
        characterId,
        otherId: other.id,
        ownType: relation.type,
        otherType: back.type,
      });
    }
  }
  const writes = [...changed.values()].map((other): CharacterWrite => ({
    kind: 'inPlaceUpdate',
    character: other,
    expectedRevision: other.revision,
  }));
  return { writes, warnings };
}

/**
 * Completes a versioned save in the order of the legacy editor save: optionally
 * the reciprocal relations and their warnings (`archui.js:306`), then every
 * holder of pending relations, the saved character included, is resolved and
 * touched (`archui.js:307`), so the links of a sheet's «Rapporti» written at
 * save have no back link, as in the legacy. One batch. `before` are the
 * relations the character had before the edit, empty for a creation.
 */
export function completeVersionedSave(
  current: readonly StoredCharacter[],
  save: Extract<CharacterWrite, { kind: 'versionedSave' }>,
  before: readonly Relation[],
  symmetricRelations: boolean,
  stamp: string,
): PlannedBatch {
  const symmetric = symmetricRelations
    ? symmetricWrites(current, save.character, before, stamp)
    : { writes: [], warnings: [] };
  return {
    batch: withPendingResolved(current, [save, ...symmetric.writes], stamp, true),
    warnings: symmetric.warnings,
  };
}

/**
 * The sheet read from a file with its pending relations resolved against the
 * archive, as the import path does before the editor opens (`archui.js:250-251`).
 * The caller passes the result to `planCreate`: the links are then relations of
 * the sheet and the symmetric save writes their back links (`archui.js:306`).
 * Other paths (an edit, «Riempi da file») must not call it, because the legacy
 * resolves their pending relations only after the symmetric loop.
 */
export function resolvePendingForPreview(
  input: CharacterInput,
  current: readonly StoredCharacter[],
): CharacterInput {
  const everyone = current.filter((row) => !row.archived).map((row) => row.character);
  const self = { ...input, id: '' } as Character;
  return omitKeys(resolveOne(self, everyone), new Set(['id'])) as CharacterInput;
}
