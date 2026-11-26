import type { Character, CharacterInput } from '../character';
import { type ArchiveDeps, nowIso } from '../deps';
import { normaliseEdit } from '../normalise';
import type { StoredCharacter } from '../../store/characterStore';
import { withoutStoreKeys } from './input';
import { completeVersionedSave } from './relations';
import type { PlannedBatch } from './types';

/**
 * Plans the creation of a character (`archui.js:297-307`): one first save, no
 * reason stored, with the editor's normalisations, plus the in-place updates
 * of the people whose pending relations name the newcomer. The id and the
 * date come from the injected deps; with `symmetricRelations` the people the
 * newcomer points to get the link back (`archui.js:304`). Throws
 * `NormaliseError` for an empty name.
 */
export function planCreate(
  current: readonly StoredCharacter[],
  input: CharacterInput,
  deps: ArchiveDeps,
  options: { readonly symmetricRelations: boolean },
): PlannedBatch {
  const id = deps.newId();
  const updated = nowIso(deps);
  const character: Character = {
    ...normaliseEdit(withoutStoreKeys(input), id),
    id,
    version: 1,
    revision: 1,
    updated,
  };
  const firstSave = {
    kind: 'versionedSave',
    character,
    expectedRevision: null,
    reason: null,
  } as const;
  return completeVersionedSave(current, firstSave, [], options.symmetricRelations, updated);
}
