import type { Character } from '../character';
import { normName } from '../normName';
import type { CharacterBatch, CharacterWrite, StoredCharacter } from '../../store/characterStore';

/** The characters the archive holds once a batch is applied, in insertion order; archived rows are not in it. */
function charactersAfter(current: readonly StoredCharacter[], batch: CharacterBatch): Character[] {
  const byId = new Map<string, Character>();
  for (const { character, archived } of current) if (!archived) byId.set(character.id, character);
  for (const write of batch) {
    if (write.kind === 'softDelete') byId.delete(write.id);
    else byId.set(write.character.id, write.character);
  }
  return [...byId.values()];
}

type Relation = NonNullable<Character['relations']>[number];

/** The first character with a name, accents and case folded. */
function holderOf(name: string, everyone: readonly Character[]): Character | undefined {
  return everyone.find((other) => normName(other.name) === normName(name));
}

/** The links a character's pending entries give, skipping the holder itself and links that exist (`archui.js:86`). */
function newLinks(character: Character, everyone: readonly Character[]): Relation[] {
  const links: Relation[] = [];
  for (const { name, type, int, view } of character.pendingRelations ?? []) {
    const target = holderOf(name, everyone);
    const known = [...(character.relations ?? []), ...links].some((link) => link.to === target?.id);
    if (target && target.id !== character.id && !known) {
      links.push({ to: target.id, type, int: int ?? 0, view: view ?? '' });
    }
  }
  return links;
}

/**
 * Turns the relations a sheet wrote by name into links for the people who now
 * exist (`archResolvePending`, `archui.js:85-88`). A name matches the first
 * character that has it; a link already there is not doubled; every entry
 * whose name matches anyone is dropped, the holder itself included, and the
 * others stay pending. Returns the same object when nothing changes.
 */
function resolveOne(character: Character, everyone: readonly Character[]): Character {
  const pending = character.pendingRelations ?? [];
  const links = newLinks(character, everyone);
  const remaining = pending.filter(({ name }) => !holderOf(name, everyone));
  if (links.length === 0 && remaining.length === pending.length) return character;
  const relations = [...(character.relations ?? []), ...links];
  return {
    ...character,
    ...(relations.length > 0 ? { relations } : {}),
    pendingRelations: remaining,
  };
}

/** Replaces the character of a write with its resolved form, when it has one. */
function withResolvedCharacter(
  write: CharacterWrite,
  resolved: ReadonlyMap<string, Character>,
): CharacterWrite {
  if (write.kind === 'softDelete') return write;
  const character = resolved.get(write.character.id);
  return character ? { ...write, character } : write;
}

/**
 * Adds to a batch the resolution of pending relations that the batch makes
 * possible (FR-016, P-03a). A character the batch writes gets the resolution
 * inside its own write; any other holder gets an in-place update, which
 * carries the revision it was read at. `stamp` is the `updated` of those
 * updates, as the legacy save gives them; `null` keeps each holder's own, which
 * is what an import does because the legacy resolves there without saving
 * (`archui.js:249`).
 */
export function withPendingResolved(
  current: readonly StoredCharacter[],
  batch: CharacterBatch,
  stamp: string | null,
): CharacterBatch {
  const everyone = charactersAfter(current, batch);
  const resolved = new Map<string, Character>();
  for (const character of everyone) {
    const after = resolveOne(character, everyone);
    if (after !== character) resolved.set(character.id, after);
  }
  const written = new Set(
    batch.flatMap((write) => (write.kind === 'softDelete' ? [] : [write.character.id])),
  );
  const revisionOf = new Map(current.map(({ character }) => [character.id, character.revision]));
  const updates = [...resolved].flatMap(([id, character]): CharacterWrite[] => {
    const expectedRevision = revisionOf.get(id);
    if (written.has(id) || expectedRevision === undefined) return [];
    return [
      {
        kind: 'inPlaceUpdate',
        character: { ...character, updated: stamp ?? character.updated },
        expectedRevision,
      },
    ];
  });
  return [...batch.map((write) => withResolvedCharacter(write, resolved)), ...updates];
}
