import type { CharacterInput } from '../character';

/** The keys the store owns: a client has no say over them (D-26-4). */
const STORE_OWNED_KEYS: ReadonlySet<string> = new Set(['id', 'legacyId', 'version', 'revision']);

/**
 * The input without the keys the store owns. The schema keeps unknown keys, so
 * a client can send an `id` or a `revision`; the planners drop them and write
 * their own.
 */
export function withoutStoreKeys(input: CharacterInput): CharacterInput {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !STORE_OWNED_KEYS.has(key)),
  ) as CharacterInput;
}
