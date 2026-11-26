import { z } from 'zod';

/**
 * The base of every game event, stored in the append-only log (FR-012). Each
 * environment narrows `kind` and `payload` with its own schema; the log keeps
 * only this shape, so a reader can order and page events without knowing the
 * environment. Keys outside it are dropped on parse, not kept.
 */
export const GameEventSchema = z.object({
  /** Version of the event's own shape, so old events stay readable after a change. */
  schema_version: z.int().positive(),
  /** Position in the game's log, from 0; unique per game and the paging key. */
  seq: z.int().nonnegative(),
  kind: z.string().min(1),
  /** Game time of the event, in the environment's own unit (minutes on the island). */
  gameTime: z.number(),
  /** The character the event belongs to, or null when none caused it. */
  actor: z.string().nullable(),
  /** The environment's data; a missing `payload` key is refused, an explicit null is not. */
  payload: z.unknown().refine((value) => value !== undefined, 'payload is required'),
});

/** One entry of a game's event log. */
export type GameEvent = z.infer<typeof GameEventSchema>;
