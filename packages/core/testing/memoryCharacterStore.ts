import type { Character, CharacterSnapshot } from '../src/archive/character';
import {
  type CharacterBatch,
  type CharacterStore,
  type CharacterVersion,
  type CharacterWrite,
  type StoredCharacter,
} from '../src/store/characterStore';
import { omitKeys } from '../src/archive/planners/input';
import { StaleWriteError } from '../src/store/errors';

interface Row {
  readonly character: Character;
  readonly archived: boolean;
}

/**
 * The whole store. A `Map` keeps the order of the first insertion, which is the
 * `seq` order `list()` promises; the history rows of a character are kept in
 * version order, oldest first.
 */
interface State {
  readonly rows: Map<string, Row>;
  readonly history: Map<string, CharacterVersion[]>;
}

/** How many superseded versions a character keeps, besides its current one (`archui.js:37`, `.slice(-15)`). */
const KEPT_VERSIONS = 15;

function copyOf(state: State): State {
  return { rows: structuredClone(state.rows), history: structuredClone(state.history) };
}

/** The row an expected revision points at; anything else is a stale write on that id. */
function rowAt({ rows }: State, id: string, expectedRevision: number): Row {
  const row = rows.get(id);
  if (row?.character.revision !== expectedRevision) throw new StaleWriteError(id);
  return row;
}

/** Adds history rows, then drops all but the highest versions: numbers only grow, so a dropped one is never reused. */
function remember(state: State, id: string, added: readonly CharacterVersion[]): void {
  const rows = [...(state.history.get(id) ?? []), ...added].sort((a, b) => a.version - b.version);
  state.history.set(id, rows.slice(-KEPT_VERSIONS));
}

const REVISION_ONLY: ReadonlySet<string> = new Set(['revision']);

/** The character as the history keeps it: no `revision`. */
function snapshotOf(character: Character): CharacterSnapshot {
  return omitKeys(character, REVISION_ONLY) as CharacterSnapshot;
}

function firstSave(state: State, write: VersionedSave): void {
  const { character } = write;
  if (state.rows.has(character.id)) throw new StaleWriteError(character.id);
  state.rows.set(character.id, { character: { ...character, revision: 1 }, archived: false });
  remember(state, character.id, write.inlineVersions ?? []);
}

function versionedSave(state: State, write: VersionedSave, expectedRevision: number): void {
  const { character } = write;
  const { character: stored } = rowAt(state, character.id, expectedRevision);
  remember(state, character.id, [
    { version: stored.version, at: stored.updated, reason: write.reason, data: snapshotOf(stored) },
  ]);
  state.rows.set(character.id, {
    character: { ...character, version: stored.version + 1, revision: stored.revision + 1 },
    archived: false,
  });
}

function inPlaceUpdate(state: State, character: Character, expectedRevision: number): void {
  const { character: stored, archived } = rowAt(state, character.id, expectedRevision);
  state.rows.set(character.id, {
    character: { ...character, version: stored.version, revision: stored.revision + 1 },
    archived,
  });
}

function softDelete(state: State, id: string, expectedRevision: number): void {
  const { character } = rowAt(state, id, expectedRevision);
  state.rows.set(id, {
    character: { ...character, revision: character.revision + 1 },
    archived: true,
  });
}

type VersionedSave = Extract<CharacterWrite, { kind: 'versionedSave' }>;

function applyWrite(state: State, write: CharacterWrite): void {
  switch (write.kind) {
    case 'versionedSave':
      if (write.expectedRevision === null) firstSave(state, write);
      else versionedSave(state, write, write.expectedRevision);
      break;
    case 'inPlaceUpdate':
      inPlaceUpdate(state, write.character, write.expectedRevision);
      break;
    case 'softDelete':
      softDelete(state, write.id, write.expectedRevision);
      break;
  }
}

class MemoryCharacterStore implements CharacterStore {
  private state: State = { rows: new Map(), history: new Map() };

  list(options?: { includeArchived?: false }): Promise<readonly Character[]>;
  list(options: { includeArchived: true }): Promise<readonly StoredCharacter[]>;
  list(options?: { includeArchived?: boolean }): Promise<readonly (Character | StoredCharacter)[]> {
    const rows = [...this.state.rows.values()].map((row) => structuredClone(row));
    if (options?.includeArchived === true) {
      return Promise.resolve(rows);
    }
    return Promise.resolve(
      rows.filter(({ archived }) => !archived).map(({ character }) => character),
    );
  }

  get(id: string): Promise<Character | null> {
    const row = this.state.rows.get(id);
    return Promise.resolve(
      row === undefined || row.archived ? null : structuredClone(row.character),
    );
  }

  versions(id: string): Promise<readonly CharacterVersion[]> {
    return Promise.resolve(structuredClone([...(this.state.history.get(id) ?? [])].reverse()));
  }

  /** All or nothing: the batch runs on a copy that replaces the rows only when every write passed; a throw in the executor rejects. */
  apply(batch: CharacterBatch): Promise<void> {
    return new Promise((resolve) => {
      const working = copyOf(this.state);
      for (const write of batch) applyWrite(working, write);
      this.state = working;
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
