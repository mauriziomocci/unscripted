import type { Character, CharacterInput } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import { normaliseEdit } from '../normalise';
import type { CharacterWrite, StoredCharacter } from '../../store/characterStore';
import { ArchiveRequestError } from './errors';
import { withoutStoreKeys } from './input';
import { findLive } from './lookup';
import { withPendingResolved } from './pending';
import type { PlannedBatch } from './types';

/** The reason the editor's save stores in the history (`archui.js:305`). */
const MANUAL_EDIT_REASON = 'modifica manuale';

export interface PlanEditOptions {
  /** `versioned`: the editor's save. `inPlace`: stored as sent, for the game's own writes (P-03). */
  readonly mode: 'versioned' | 'inPlace';
  readonly symmetricRelations: boolean;
}

/** Refuses an input that names another character than the target; the id belongs to the path, not the body. */
function assertSameId(input: CharacterInput, id: string): void {
  if (input.id !== undefined && input.id !== id) {
    throw new ArchiveRequestError(
      'id_mismatch',
      `the body names another character than the target ${id}`,
    );
  }
}

/**
 * Plans the edit of a stored character. The store-owned keys (`version`,
 * `revision`, `legacyId`) carry what was read: the store bumps them when it
 * applies the write. `expectedRevision` is the one the caller read; a stale one
 * is refused by the store with `StaleWriteError`, not here.
 *
 * `versioned` normalises like the editor, stores the reason «modifica manuale»
 * and resolves pending relations; `inPlace` stores the input as sent. Throws
 * `CharacterNotFoundError`, `ArchiveRequestError` or `NormaliseError`.
 */
export function planEdit(
  current: readonly StoredCharacter[],
  id: string,
  input: CharacterInput,
  expectedRevision: number,
  deps: ArchiveDeps,
  options: PlanEditOptions,
): PlannedBatch {
  const existing = findLive(current, id);
  assertSameId(input, id);
  const updated = nowIso(deps);
  const owned = {
    id,
    ...(existing.legacyId === undefined ? {} : { legacyId: existing.legacyId }),
    version: existing.version,
    revision: existing.revision,
    updated,
  };
  const sent = withoutStoreKeys(input);
  if (options.mode === 'inPlace') {
    const character: Character = { ...sent, ...owned };
    return { batch: [{ kind: 'inPlaceUpdate', character, expectedRevision }], warnings: [] };
  }
  const character: Character = { ...normaliseEdit(sent, id), ...owned };
  const save: CharacterWrite = {
    kind: 'versionedSave',
    character,
    expectedRevision,
    reason: MANUAL_EDIT_REASON,
  };
  return { batch: withPendingResolved(current, [save], updated), warnings: [] };
}
