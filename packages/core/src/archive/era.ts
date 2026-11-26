/** The three sections of the archive: present time, the Venture's future, and the novel. */
export type ArchiveEra = 'presente' | 'futuro' | 'romanzo';

/**
 * The section a character belongs to (`archEra`, `archfuturo.js:29`). The
 * record accepts any `era` string, so every value that is not `futuro` or
 * `romanzo` reads as present time, and a character without `era` too.
 */
export function archEra(character: { readonly era?: string | undefined }): ArchiveEra {
  return character.era === 'futuro' || character.era === 'romanzo' ? character.era : 'presente';
}
