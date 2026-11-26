import type { Character, CharacterInput } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import { normaliseEdit } from '../normalise';
import type { StoredCharacter } from '../../store/characterStore';
import { ArchiveRequestError } from './errors';
import { withoutStoreKeys } from './input';
import { findLive } from './lookup';
import { completeVersionedSave } from './relations';
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

/** The keys the planner writes over whatever the client sent: they carry what was read, and the new `updated`. */
function ownedKeys(existing: Character, id: string, updated: string) {
  return {
    id,
    ...(existing.legacyId === undefined ? {} : { legacyId: existing.legacyId }),
    version: existing.version,
    revision: existing.revision,
    updated,
  };
}

/** Refuses an edit mode the options contradict: reciprocal relations are a versioned save's business. */
function assertModeAllowsOptions(options: PlanEditOptions): void {
  if (options.mode === 'inPlace' && options.symmetricRelations) {
    throw new ArchiveRequestError(
      'symmetric_in_place',
      'symmetric relations need a versioned edit',
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
 * and resolves pending relations; `inPlace` stores the input as sent.
 * `symmetricRelations` writes the reciprocal links and the mismatch warnings
 * (`archui.js:304-306`) and is refused with `inPlace`. Throws
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
  assertModeAllowsOptions(options);
  const updated = nowIso(deps);
  const owned = ownedKeys(existing, id, updated);
  const sent = withoutStoreKeys(input);
  if (options.mode === 'inPlace') {
    const character: Character = { ...sent, ...owned };
    return { batch: [{ kind: 'inPlaceUpdate', character, expectedRevision }], warnings: [] };
  }
  const character: Character = { ...normaliseEdit(sent, id), ...owned };
  const save = {
    kind: 'versionedSave',
    character,
    expectedRevision,
    reason: MANUAL_EDIT_REASON,
  } as const;
  const before = existing.relations ?? [];
  return completeVersionedSave(current, save, before, options.symmetricRelations, updated);
}
