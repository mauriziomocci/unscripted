import type { ArchiveFileV1 } from './archiveFile';
import { nowIso } from './deps';
import { omitKeys } from './planners/input';
import type { StoredCharacter } from '../store/characterStore';
import type { Clock } from '../time/ports';

/** Keys the file never carries: the store's revision, the legacy id (it becomes the `id`) and any inline history. */
const NOT_EXPORTED: ReadonlySet<string> = new Set(['revision', 'legacyId', 'versions']);

/**
 * Builds the portable archive (`archivio/1`, `archui.js:211`, FR-026) from the
 * characters a store lists with `includeArchived`, in that order. Deleted
 * characters are left out, and so are versions and revisions. Each character
 * and each relation target is written with its legacy id when it has one and
 * its uuid otherwise (FR-017), so the legacy artifact and the web app both
 * import the file back without duplicates.
 */
export function toArchiveFile(characters: readonly StoredCharacter[], clock: Clock): ArchiveFileV1 {
  const live = characters.filter(({ archived }) => !archived).map(({ character }) => character);
  const fileId = new Map(live.map(({ id, legacyId }) => [id, legacyId ?? id]));
  const chars = live.map((character) => ({
    ...omitKeys(character, NOT_EXPORTED),
    id: fileId.get(character.id),
    ...(character.relations === undefined
      ? {}
      : {
          relations: character.relations.map((relation) => ({
            ...relation,
            to: fileId.get(relation.to) ?? relation.to,
          })),
        }),
  }));
  return { schema: 'archivio/1', exported: nowIso({ clock }), chars };
}
