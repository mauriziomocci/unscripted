/**
 * The keys of a character's `sections`, in the legacy order: the seven the
 * editor shows (`archui.js:4-12`) and `altro`, where the parser keeps text it
 * could not place. Secrets, goals and relations are separate fields, not sections.
 */
export const TEXT_SECTION_KEYS = [
  'identita',
  'storia',
  'carattere',
  'valori',
  'paure',
  'parlata',
  'relazioni_stile',
  'altro',
] as const;
