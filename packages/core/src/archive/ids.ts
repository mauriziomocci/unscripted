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
