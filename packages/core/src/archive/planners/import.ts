import { ArchiveFileSchema } from '../archiveFile';
import { blankCharacterInput } from '../blank';
import { type Character, CharacterSchema, CharacterSnapshotSchema } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import { mapIncomingId, withMappedRelations } from '../ids';
import { hasPrototypeKey } from '../prototypeKeys';
import { z } from 'zod';
import type {
  CharacterBatch,
  CharacterVersion,
  CharacterWrite,
  StoredCharacter,
} from '../../store/characterStore';
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

/** How many prior versions the archive keeps per character (`archui.js:37`, `.slice(-15)`). */
const MAX_INLINE_VERSIONS = 15;

/** The inline history of a raw record: a list of objects, each a legacy row `{ v, at, why, data }`. */
const InlineRowsSchema = z.array(z.record(z.string(), z.unknown()));

/** A character as the file gives it, completed and checked, with the history rows it carried. */
interface IncomingCharacter {
  readonly character: Character;
  readonly history: readonly CharacterVersion[];
}

type RawRow = Readonly<Record<string, unknown>>;

/** Keeps the rows whose `v` is an integer below the version, one per `v` (the last), the last 15 in array order. */
function usableRows(rows: readonly RawRow[], version: number): RawRow[] {
  const seen = new Set<unknown>();
  const kept: RawRow[] = [];
  for (const candidate of [...rows].reverse()) {
    const { v } = candidate;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v < version && !seen.has(v)) {
      seen.add(v);
      kept.unshift(candidate);
    }
  }
  return kept.slice(-MAX_INLINE_VERSIONS);
}

/** One history row: the snapshot is completed, checked and id-mapped like a character (FR-017). */
function historyRow(character: Character, row: RawRow, stamp: string): CharacterVersion {
  const at = typeof row.at === 'string' ? row.at : null;
  const data: unknown = row.data;
  if (typeof data !== 'object' || data === null)
    throw new InvalidArchiveFileError('a version has no data');
  const candidate = {
    ...blankCharacterInput(),
    updated: at ?? stamp,
    ...omitKeys(data as Record<string, unknown>, DROPPED_KEYS),
    id: character.id,
    ...(character.legacyId === undefined ? {} : { legacyId: character.legacyId }),
    version: row.v as number,
  };
  const checked = CharacterSnapshotSchema.safeParse(candidate);
  if (!checked.success)
    throw new InvalidArchiveFileError('a version is not valid', { cause: checked.error });
  return {
    version: row.v as number,
    at,
    reason: typeof row.why === 'string' ? row.why : null,
    data: withMappedRelations(checked.data),
  };
}

/**
 * Completes an incoming record the way the legacy does, `Object.assign(archBlank(), c)`
 * (`archui.js:249`), then checks it against the character schema and maps its ids
 * (FR-017); its inline `versions` become history rows (edge cases). An id that is
 * missing, empty or not text gets a fresh one. Throws `InvalidArchiveFileError`
 * when the record or a kept version is not valid.
 */
function completeRecord(raw: RawRow, deps: ArchiveDeps, stamp: string): IncomingCharacter {
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
  const character = withMappedRelations(checked.data);
  const rows = InlineRowsSchema.safeParse(raw.versions ?? []);
  if (!rows.success)
    throw new InvalidArchiveFileError('versions is not a list of objects', { cause: rows.error });
  const history = usableRows(rows.data, character.version).map((row) =>
    historyRow(character, row, stamp),
  );
  return { character, history };
}

/**
 * The write for one incoming character: a versioned save over the stored row,
 * live or deleted, with the reason «import archivio» (its inline versions are
 * discarded, the stored history stays), or a first save with its inline versions.
 */
function writeFor(
  { character, history }: IncomingCharacter,
  stored: StoredCharacter | undefined,
  stamp: string,
): CharacterWrite {
  if (stored) {
    const { version, revision } = stored.character;
    return {
      kind: 'versionedSave',
      expectedRevision: revision,
      reason: IMPORT_REASON,
      character: { ...character, version, revision, updated: stamp },
    };
  }
  const firstSave = {
    kind: 'versionedSave',
    expectedRevision: null,
    reason: null,
    character: { ...character, updated: stamp },
  } as const;
  return history.length > 0 ? { ...firstSave, inlineVersions: history } : firstSave;
}

/**
 * Plans an `archivio/1` import (`archui.js:249`, FR-025). The whole file is
 * checked before anything is planned, so a bad file plans nothing. A character
 * is skipped when a live one is as new or newer (`updated` compared as strings),
 * and otherwise written by `writeFor`; ids and relation targets go through one
 * map (FR-017). A character listed twice is imported once. Pending relations
 * are resolved afterwards without touching anyone's `updated`, because the
 * legacy resolves in memory there and does not save. Throws `InvalidArchiveFileError`.
 */
export function planImport(
  current: readonly StoredCharacter[],
  file: unknown,
  deps: ArchiveDeps,
): CharacterBatch {
  const stamp = nowIso(deps);
  const incoming = readArchiveFile(file).map((raw) => completeRecord(raw, deps, stamp));
  const rows = new Map(current.map((row) => [row.character.id, row]));
  const writes: CharacterWrite[] = [];
  for (const entry of incoming) {
    const { id, updated } = entry.character;
    const row = rows.get(id);
    if (row && !row.archived && row.character.updated >= updated) continue;
    writes.push(writeFor(entry, row, stamp));
    rows.set(id, { character: { ...entry.character, updated: stamp }, archived: false });
  }
  return withPendingResolved(current, writes, null);
}
