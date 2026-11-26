import type { Character, CharacterSnapshot } from '../archive/character';

/** A notice a save produced (FR-016, FR-072): the legacy toast of `archui.js:306`, shown by the UI. */
export interface ArchiveWarning {
  readonly code: 'relation_mismatch';
  readonly characterId: string;
  readonly otherId: string;
  readonly ownType: string;
  readonly otherType: string;
}

/** What a save returns: the stored character and the notices the planner raised while building the batch. */
export interface WriteResult {
  readonly character: Character;
  readonly warnings: readonly ArchiveWarning[];
}

/** One superseded version of a character, as the history lists it. */
export interface CharacterVersion {
  readonly version: number;
  /** The superseded version's own `updated` (`archui.js:37`). */
  readonly at: string | null;
  /** Reason of the save that superseded it (`archui.js:37`); null when none was stored. */
  readonly reason: string | null;
  readonly data: CharacterSnapshot;
}

/** A character with the flag the planners need: whether it is soft-deleted (FR-017, FR-024). */
export interface StoredCharacter {
  readonly character: Character;
  readonly archived: boolean;
}

/**
 * One write of a batch. `expectedRevision` is the concurrency guard: the
 * revision the caller read, or `null` for a first save, which must find no
 * such id.
 */
export type CharacterWrite =
  | {
      readonly kind: 'versionedSave';
      readonly character: Character;
      readonly expectedRevision: number | null;
      readonly reason: string | null;
      readonly inlineVersions?: readonly CharacterVersion[];
    }
  | {
      readonly kind: 'inPlaceUpdate';
      readonly character: Character;
      readonly expectedRevision: number;
    }
  | { readonly kind: 'softDelete'; readonly id: string; readonly expectedRevision: number };

/** What a planner returns and a store applies, all or nothing. */
export type CharacterBatch = readonly CharacterWrite[];

/**
 * Persistence of characters and nothing else (P-03): the rules live in the
 * planners, so both stores behave alike. `apply` is one atomic write; a stale
 * revision anywhere refuses the whole batch with `StaleWriteError`.
 */
export interface CharacterStore {
  /**
   * Not soft-deleted by default; the planners ask for archived rows too
   * (FR-017, FR-024). Order: insertion order (`seq`), the same on both stores
   * and asserted by the FR-050 suite.
   */
  list(options?: { includeArchived?: false }): Promise<readonly Character[]>;
  list(options: { includeArchived: true }): Promise<readonly StoredCharacter[]>;
  get(id: string): Promise<Character | null>;
  /** Newest first, at most 15. */
  versions(id: string): Promise<readonly CharacterVersion[]>;
  apply(batch: CharacterBatch): Promise<void>;
}
