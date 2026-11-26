import type {
  CharacterBatch,
  CharacterStore,
  CharacterVersion,
  WriteResult,
} from '../store/characterStore';
import type { ArchiveClient } from './archiveClient';
import type { ArchiveFileV1 } from './archiveFile';
import type { Character, CharacterInput } from './character';
import type { ArchiveDeps } from './deps';
import { toArchiveFile } from './export';
import { planCreate } from './planners/create';
import { planDelete } from './planners/delete';
import { planEdit } from './planners/edit';
import { CharacterNotFoundError } from './planners/errors';
import { planImport } from './planners/import';
import { planPack } from './planners/pack';
import { planRestore } from './planners/restore';

/** How many writes of a batch are saves of a whole character: the added or replaced ones, not the in-place side effects. */
function savedCount(batch: CharacterBatch): number {
  return batch.filter(({ kind }) => kind === 'versionedSave').length;
}

/** The id of the character a create batch adds: its first write is the save (`completeVersionedSave`). */
function createdId(batch: CharacterBatch): string {
  const [save] = batch;
  if (save?.kind !== 'versionedSave')
    throw new Error('a create batch starts with a versioned save');
  return save.character.id;
}

/** The planners' deps plus the ready-made characters `addPack` offers; none by default. */
export interface StoreArchiveDeps extends ArchiveDeps {
  readonly packs?: readonly (readonly Character[])[];
}

/**
 * The single applier of the archive planners (R-18): it reads the current
 * records from a `CharacterStore`, asks a planner for one batch and applies it
 * with one `store.apply`. Every archive rule lives in the planners, so the
 * server's routes and the artifact's `LocalArchive` behave alike. A stale
 * revision anywhere in a batch refuses the whole batch with `StaleWriteError`.
 *
 * The ready-made characters `addPack` offers come with the deps (`packs`).
 */
export class StoreArchive implements ArchiveClient {
  private readonly store: CharacterStore;
  private readonly deps: StoreArchiveDeps;

  constructor(store: CharacterStore, deps: StoreArchiveDeps) {
    this.store = store;
    this.deps = deps;
  }

  list(): Promise<readonly Character[]> {
    return this.store.list();
  }

  get(id: string): Promise<Character | null> {
    return this.store.get(id);
  }

  versions(id: string): Promise<readonly CharacterVersion[]> {
    return this.store.versions(id);
  }

  async create(
    input: CharacterInput,
    options: { symmetricRelations?: boolean } = {},
  ): Promise<WriteResult> {
    const current = await this.store.list({ includeArchived: true });
    const symmetricRelations = options.symmetricRelations ?? true;
    const { batch, warnings } = planCreate(current, input, this.deps, { symmetricRelations });
    await this.store.apply(batch);
    return { character: await this.stored(createdId(batch)), warnings };
  }

  async edit(
    id: string,
    input: CharacterInput,
    expectedRevision: number,
    options: { mode?: 'versioned' | 'inPlace'; symmetricRelations?: boolean } = {},
  ): Promise<WriteResult> {
    const current = await this.store.list({ includeArchived: true });
    const mode = options.mode ?? 'versioned';
    const symmetricRelations = options.symmetricRelations ?? mode === 'versioned';
    const { batch, warnings } = planEdit(current, id, input, expectedRevision, this.deps, {
      mode,
      symmetricRelations,
    });
    await this.store.apply(batch);
    return { character: await this.stored(id), warnings };
  }

  async restore(id: string, version: number, expectedRevision: number): Promise<Character> {
    const current = await this.store.list({ includeArchived: true });
    const history = await this.store.versions(id);
    await this.store.apply(planRestore(current, history, id, version, expectedRevision, this.deps));
    return this.stored(id);
  }

  async delete(id: string): Promise<void> {
    const current = await this.store.list({ includeArchived: true });
    await this.store.apply(planDelete(current, id, this.deps));
  }

  async importArchive(file: unknown): Promise<{ imported: number; skipped: number }> {
    const current = await this.store.list({ includeArchived: true });
    const { batch, skipped } = planImport(current, file, this.deps);
    await this.store.apply(batch);
    return { imported: savedCount(batch), skipped };
  }

  async exportArchive(): Promise<ArchiveFileV1> {
    return toArchiveFile(await this.store.list({ includeArchived: true }), this.deps.clock);
  }

  async addPack(): Promise<{ added: number }> {
    const current = await this.store.list({ includeArchived: true });
    const batch = planPack(current, this.deps.packs ?? [], this.deps);
    await this.store.apply(batch);
    return { added: savedCount(batch) };
  }

  /** The character as the store now holds it: the planner's copy has the revision it read, not the one the store wrote. */
  private async stored(id: string): Promise<Character> {
    const character = await this.store.get(id);
    if (character === null) throw new CharacterNotFoundError(id);
    return character;
  }
}
