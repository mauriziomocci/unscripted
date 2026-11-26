import type { Character } from './character';
import { v5 as uuidV5, validate as isUuid } from 'uuid';

/**
 * Namespace of every id derived from a legacy id (FR-017). Generated once and
 * fixed for good: it is part of the data, because the same legacy id must map
 * to the same uuid in every import, in the web app and in the artifact, and
 * across years. Never change it; a test pins the value.
 */
export const LEGACY_ID_NAMESPACE = 'f0338bcd-0d4a-461e-9b1f-5c8a0414a6bc';

/**
 * The id a character gets when it comes in from a file or a legacy store.
 * A uuid is kept. A non-empty string that is not a uuid (`c_x1`, `f_x1`, the
 * ids of the legacy game) becomes its uuid v5 and is remembered as
 * `legacyId`. Anything else (missing, empty, `null`, not a string) has no
 * identity to keep and gets a fresh id from `newId`; v1 accepts that deviation
 * from the legacy, which kept such records as they were (parity row).
 *
 * `newId` is injected because a fresh uuid is randomness, which the pure core
 * never draws itself (A-03); v5 is a pure function of its input.
 */
export function mapIncomingId(id: unknown, newId: () => string): { id: string; legacyId?: string } {
  if (typeof id !== 'string' || id === '') return { id: newId() };
  if (isUuid(id)) return { id };
  return { id: uuidV5(id, LEGACY_ID_NAMESPACE), legacyId: id };
}

/**
 * The id a relation `to` field becomes under the same map as the ids: a uuid
 * and an empty value stay, any other string is a legacy id and gets its v5. It
 * never draws a fresh id, so a relation always lands on the uuid its target
 * got in the same import (FR-017).
 */
export function mapReferenceId(reference: string): string {
  return reference === '' || isUuid(reference) ? reference : uuidV5(reference, LEGACY_ID_NAMESPACE);
}

/** The character with every relation target mapped by `mapReferenceId`. */
export function withMappedRelations<T extends Pick<Character, 'relations'>>(character: T): T {
  if (character.relations === undefined) return character;
  const relations = character.relations.map((relation) => ({
    ...relation,
    to: mapReferenceId(relation.to),
  }));
  return { ...character, relations };
}

/**
 * The character with its id mapped by `mapIncomingId` and every relation target
 * mapped by `mapReferenceId`, the one id map of a pack or a seed (FR-017). A
 * `legacyId` the record already had is kept.
 */
export function withMappedIds(character: Character, newId: () => string): Character {
  const { id, legacyId = character.legacyId } = mapIncomingId(character.id, newId);
  return withMappedRelations({ ...character, id, ...(legacyId === undefined ? {} : { legacyId }) });
}
