import type { CharacterVersion, WriteResult } from '../store/characterStore';
import type { ArchiveFileV1 } from './archiveFile';
import type { Character, CharacterInput } from './character';

/**
 * What the UI uses to read and write the archive (P-03b). `StoreArchive`
 * implements it over any `CharacterStore`; `HttpStore` implements it over the
 * routes. Disabling is not a separate operation: the «Disattivato» checkbox is
 * part of the editor save, so it goes through `edit`.
 */
export interface ArchiveClient {
  list(): Promise<readonly Character[]>;
  get(id: string): Promise<Character | null>;
  /** Newest first, at most 15 rows. */
  versions(id: string): Promise<readonly CharacterVersion[]>;
  create(input: CharacterInput, options?: { symmetricRelations?: boolean }): Promise<WriteResult>;
  /**
   * `id` comes from the caller (the path, in HTTP); `expectedRevision` is the
   * only concurrency input. `versioned` (the default) normalises like the
   * editor, stores the reason «modifica manuale» and writes symmetric
   * relations unless told not to. `inPlace` stores as sent, with no
   * normalisation, and refuses `symmetricRelations: true`.
   */
  edit(
    id: string,
    input: CharacterInput,
    expectedRevision: number,
    options?: { mode?: 'versioned' | 'inPlace'; symmetricRelations?: boolean },
  ): Promise<WriteResult>;
  restore(id: string, version: number, expectedRevision: number): Promise<Character>;
  /** A soft delete: the character leaves every list and the relations pointing to it are removed. */
  delete(id: string): Promise<void>;
  importArchive(file: unknown): Promise<{ imported: number; skipped: number }>;
  exportArchive(): Promise<ArchiveFileV1>;
  addPack(): Promise<{ added: number }>;
}
