import type { Character } from '../character';
import type { ArchiveWarning, CharacterWrite, StoredCharacter } from '../../store/characterStore';
import { charactersAfter, resolveOne, withPendingResolved } from './pending';
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
 * Completes a versioned save in the order of the legacy editor save: the saved
 * character's own pending relations are resolved first (`archui.js:251`), so the
 * links are among its relations; then, optionally, the reciprocal relations and
 * their warnings (`archui.js:306`), where the links just resolved count as
 * existing before the save; then every other holder of pending relations is
 * touched (`archui.js:307`). One batch. `before` are the relations the
 * character had before the edit, empty for a creation.
 */
export function completeVersionedSave(
  current: readonly StoredCharacter[],
  save: Extract<CharacterWrite, { kind: 'versionedSave' }>,
  before: readonly Relation[],
  symmetricRelations: boolean,
  stamp: string,
): PlannedBatch {
  const resolved = resolveOne(save.character, charactersAfter(current, [save]));
  const own = { ...save, character: resolved };
  const ownLinks = (resolved.relations ?? []).filter(
    (link) => !(save.character.relations ?? []).includes(link),
  );
  const symmetric = symmetricRelations
    ? symmetricWrites(current, resolved, [...before, ...ownLinks], stamp)
    : { writes: [], warnings: [] };
  return {
    batch: withPendingResolved(current, [own, ...symmetric.writes], stamp, true),
    warnings: symmetric.warnings,
  };
}
