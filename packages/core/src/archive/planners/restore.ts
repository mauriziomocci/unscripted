import type { Character } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import type { CharacterBatch, CharacterVersion, StoredCharacter } from '../../store/characterStore';
import { VersionNotFoundError } from './errors';
import { findLive } from './lookup';

/**
 * Plans the restore of a version (`archui.js:293`): a versioned save whose data
 * is that version's snapshot and whose reason is «ripristino vN», so the
 * restore is itself undoable. `history` is the character's version list. The
 * id stays the character's own; `version` and `revision` carry what was read,
 * which the store bumps. Throws `CharacterNotFoundError` or
 * `VersionNotFoundError`.
 */
export function planRestore(
  current: readonly StoredCharacter[],
  history: readonly CharacterVersion[],
  id: string,
  version: number,
  expectedRevision: number,
  deps: ArchiveDeps,
): CharacterBatch {
  const existing = findLive(current, id);
  const row = history.find((entry) => entry.version === version);
  if (!row) throw new VersionNotFoundError(id, version);
  const character: Character = {
    ...row.data,
    id,
    version: existing.version,
    revision: existing.revision,
    updated: nowIso(deps),
  };
  return [
    {
      kind: 'versionedSave',
      character,
      expectedRevision,
      reason: `ripristino v${String(version)}`,
    },
  ];
}
