import type { Character } from '../src/archive/character';
import {
  type CharacterBatch,
  type CharacterStore,
  type CharacterVersion,
  type CharacterWrite,
  type StoredCharacter,
} from '../src/store/characterStore';
import { StaleWriteError } from '../src/store/errors';

interface Row {
  readonly character: Character;
  readonly archived: boolean;
}

/** Rows by id. A `Map` keeps the order of the first insertion, which is the `seq` order `list()` promises. */
type Rows = Map<string, Row>;

/** The row an expected revision points at; anything else is a stale write on that id. */
function rowAt(rows: Rows, id: string, expectedRevision: number): Row {
  const row = rows.get(id);
  if (row?.character.revision !== expectedRevision) throw new StaleWriteError(id);
  return row;
}

function firstSave(rows: Rows, character: Character): void {
  if (rows.has(character.id)) throw new StaleWriteError(character.id);
  rows.set(character.id, { character: { ...character, revision: 1 }, archived: false });
}

function versionedSave(rows: Rows, character: Character, expectedRevision: number): void {
  const { character: stored } = rowAt(rows, character.id, expectedRevision);
  rows.set(character.id, {
    character: { ...character, version: stored.version + 1, revision: stored.revision + 1 },
    archived: false,
  });
}

function inPlaceUpdate(rows: Rows, character: Character, expectedRevision: number): void {
  const { character: stored, archived } = rowAt(rows, character.id, expectedRevision);
  rows.set(character.id, {
    character: { ...character, version: stored.version, revision: stored.revision + 1 },
    archived,
  });
}

function softDelete(rows: Rows, id: string, expectedRevision: number): void {
  const { character } = rowAt(rows, id, expectedRevision);
  rows.set(id, { character: { ...character, revision: character.revision + 1 }, archived: true });
}

function applyWrite(rows: Rows, write: CharacterWrite): void {
  switch (write.kind) {
    case 'versionedSave':
      if (write.expectedRevision === null) firstSave(rows, write.character);
      else versionedSave(rows, write.character, write.expectedRevision);
      break;
    case 'inPlaceUpdate':
      inPlaceUpdate(rows, write.character, write.expectedRevision);
      break;
    case 'softDelete':
      softDelete(rows, write.id, write.expectedRevision);
      break;
  }
}

class MemoryCharacterStore implements CharacterStore {
  private rows: Rows = new Map();

  list(options?: { includeArchived?: false }): Promise<readonly Character[]>;
  list(options: { includeArchived: true }): Promise<readonly StoredCharacter[]>;
  list(options?: { includeArchived?: boolean }): Promise<readonly (Character | StoredCharacter)[]> {
    const rows = [...this.rows.values()].map((row) => structuredClone(row));
    if (options?.includeArchived === true) {
      return Promise.resolve(rows);
    }
    return Promise.resolve(
      rows.filter(({ archived }) => !archived).map(({ character }) => character),
    );
  }

  get(id: string): Promise<Character | null> {
    const row = this.rows.get(id);
    return Promise.resolve(
      row === undefined || row.archived ? null : structuredClone(row.character),
    );
  }

  versions(): Promise<readonly CharacterVersion[]> {
    return Promise.resolve([]);
  }

  /** All or nothing: the batch runs on a copy that replaces the rows only when every write passed; a throw in the executor rejects. */
  apply(batch: CharacterBatch): Promise<void> {
    return new Promise((resolve) => {
      const working: Rows = structuredClone(this.rows);
      for (const write of batch) applyWrite(working, write);
      this.rows = working;
      resolve();
    });
  }
}

/**
 * An in-memory `CharacterStore`, the test double of the packages that need
 * one (the planners' applier, the UI): the same contract as the real stores,
 * which `describeCharacterStore` checks on all three.
 */
export function createMemoryCharacterStore(): CharacterStore {
  return new MemoryCharacterStore();
}
