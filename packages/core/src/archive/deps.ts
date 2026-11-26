import type { Clock } from '../time/ports';

/**
 * What the planners need from outside, injected because the pure core owns
 * neither a clock nor a source of randomness (A-03).
 */
export interface ArchiveDeps {
  readonly clock: Clock;
  /** A fresh character id: a uuid. */
  readonly newId: () => string;
}

/** The `updated` stamp of a save: the clock's now as an ISO string, as the legacy writes it (`archui.js:38`). */
export function nowIso(deps: ArchiveDeps): string {
  return new Date(deps.clock.now()).toISOString();
}
