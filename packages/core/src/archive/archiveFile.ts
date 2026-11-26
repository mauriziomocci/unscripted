import { z } from 'zod';

/**
 * The portable archive (`archivio/1`, `archui.js:211`): the characters without
 * their versions or revisions. The characters are checked one by one by the
 * import planner, which owns the rules of what a record needs.
 */
export interface ArchiveFileV1 {
  readonly schema: 'archivio/1';
  /** When the file was written, as an ISO string. */
  readonly exported: string;
  readonly chars: readonly unknown[];
}

/** What an import accepts of a file: the schema tag and a list of objects; `exported` is informative only. */
export const ArchiveFileSchema = z.looseObject({
  schema: z.literal('archivio/1'),
  exported: z.string().optional(),
  chars: z.array(z.record(z.string(), z.unknown())),
});
