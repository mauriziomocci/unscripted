import type { GameEvent } from '../events/gameEvent';

/** The four ways to play; a game belongs to exactly one. */
export type Environment = 'island' | 'talkshow' | 'venture' | 'novel';

/** One atomic write of a game: the new events and the state they lead to. */
export interface GameCommit {
  readonly gameId: string;
  /** The `seq` the log must have reached; any other value means another writer got there first. */
  readonly expectedSeq: number;
  readonly events: readonly GameEvent[];
  readonly state: unknown;
}

/**
 * Persistence of games (P-04): types only in WI-1, implemented by both stores
 * in WI-2 (FR-052).
 */
export interface GameStore {
  createGame(environment: Environment, setup: unknown): Promise<{ gameId: string }>;
  getGame(gameId: string): Promise<{
    gameId: string;
    environment: Environment;
    lastSeq: number;
    state: unknown;
  } | null>;
  /** Throws `StaleWriteError` on a stale `expectedSeq`. */
  commit(commit: GameCommit): Promise<void>;
  events(gameId: string, page: { afterSeq: number; limit: number }): Promise<readonly GameEvent[]>;
  reports(gameId: string): Promise<readonly unknown[]>;
  saveReport(gameId: string, kind: string, data: unknown): Promise<void>;
}
