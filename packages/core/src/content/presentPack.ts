import { CharacterSnapshotSchema, type Character } from '../archive/character';
import archpack from './archpack.json' with { type: 'json' };

/**
 * The 16 ready-made present characters of the legacy `archpack.js`, generated
 * by `pnpm content:generate` and parsed once at load, so a record the schema
 * no longer accepts fails at import, not in the middle of a game. The legacy
 * records carry no `revision` (it belongs to the store), so each one gets the
 * first revision, which `planPack` replaces when it writes. The server
 * seeds them once per database and «Personaggi pronti» adds them (FR-024).
 */
export const PRESENT_PACK: readonly Character[] = CharacterSnapshotSchema.array()
  .parse(archpack.chars)
  .map((record) => ({ ...record, revision: 1 }));
