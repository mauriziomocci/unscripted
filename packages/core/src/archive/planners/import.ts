import { ArchiveFileSchema } from '../archiveFile';
import { blankCharacterInput } from '../blank';
import { type Character, CharacterSchema } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import { mapIncomingId, withMappedRelations } from '../ids';
import { hasPrototypeKey } from '../prototypeKeys';
import type { CharacterBatch, CharacterWrite, StoredCharacter } from '../../store/characterStore';
import { InvalidArchiveFileError } from './errors';
import { omitKeys } from './input';
import { withPendingResolved } from './pending';

/** The reason stored when an import replaces a character (`archui.js:249`). */
const IMPORT_REASON = 'import archivio';

/** Keys of an incoming record that never reach the store: the revision is the store's, the inline history is handled apart. */
const DROPPED_KEYS: ReadonlySet<string> = new Set(['id', 'revision', 'versions']);

/** Throws `InvalidArchiveFileError` unless the file is an `archivio/1` with no prototype key anywhere. */
function readArchiveFile(file: unknown): readonly Record<string, unknown>[] {
  if (hasPrototypeKey(file)) throw new InvalidArchiveFileError('the archive holds a prototype key');
  const parsed = ArchiveFileSchema.safeParse(file);
  if (!parsed.success)
    throw new InvalidArchiveFileError('not an archivio/1 file', { cause: parsed.error });
  return parsed.data.chars;
}

/**
 * Completes an incoming record the way the legacy does, `Object.assign(archBlank(), c)`
 * (`archui.js:249`), then checks it against the character schema and maps its ids
 * (FR-017). An id that is missing, empty or not text gets a fresh one. Throws
 * `InvalidArchiveFileError` when the record is not a valid character.
 */
function completeRecord(
  raw: Readonly<Record<string, unknown>>,
  deps: ArchiveDeps,
  stamp: string,
): Character {
  const identity = mapIncomingId(raw.id, deps.newId);
  const candidate = {
    ...blankCharacterInput(),
    version: 1,
    updated: stamp,
    ...omitKeys(raw, DROPPED_KEYS),
    ...identity,
    revision: 1,
  };
  const checked = CharacterSchema.safeParse(candidate);
  if (!checked.success)
    throw new InvalidArchiveFileError('a character is not valid', { cause: checked.error });
  return withMappedRelations(checked.data);
}

/**
 * Plans an `archivio/1` import (`archui.js:249`, FR-025). The whole file is
 * checked before anything is planned, so a bad file plans nothing. A character
 * is skipped when the stored one is as new or newer (`updated` compared as
 * strings), replaced by a versioned save with the reason «import archivio»
 * when older, and added as a first save otherwise; ids and relation targets go
 * through one map (FR-017). A character listed twice is imported once. Pending
 * relations are resolved afterwards without touching anyone's `updated`,
 * because the legacy resolves in memory there and does not save.
 * Throws `InvalidArchiveFileError`.
 */
export function planImport(
  current: readonly StoredCharacter[],
  file: unknown,
  deps: ArchiveDeps,
): CharacterBatch {
  const stamp = nowIso(deps);
  const incoming = readArchiveFile(file).map((raw) => completeRecord(raw, deps, stamp));
  const stored = new Map(
    current.filter((row) => !row.archived).map((row) => [row.character.id, row.character]),
  );
  const writes: CharacterWrite[] = [];
  for (const character of incoming) {
    const existing = stored.get(character.id);
    if (existing && existing.updated >= character.updated) continue;
    stored.set(character.id, { ...character, updated: stamp });
    writes.push(
      existing
        ? {
            kind: 'versionedSave',
            expectedRevision: existing.revision,
            reason: IMPORT_REASON,
            character: {
              ...character,
              version: existing.version,
              revision: existing.revision,
              updated: stamp,
            },
          }
        : {
            kind: 'versionedSave',
            expectedRevision: null,
            reason: null,
            character: { ...character, updated: stamp },
          },
    );
  }
  return withPendingResolved(current, writes, null);
}
