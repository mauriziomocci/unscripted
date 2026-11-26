/**
 * A write was refused because the record moved since the caller read it
 * (its `revision`, or a game's `seq`, no longer matches). The whole batch is
 * refused; the caller reloads and decides, it never retries blindly.
 */
export class StaleWriteError extends Error {
  /** The record that moved. */
  readonly id: string;

  constructor(id: string, options?: ErrorOptions) {
    super(`stale write: ${id} changed since it was read`, options);
    this.name = 'StaleWriteError';
    this.id = id;
  }
}

/** The store cannot be reached or refused to run (database down, browser storage blocked); nothing was written. */
export class StoreUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StoreUnavailableError';
  }
}
