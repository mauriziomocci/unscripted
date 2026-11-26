import { normName } from './normName';

/**
 * The eight stations of the Venture's bridge: key, as stored in `role`, and
 * the singular label the generator prompt prints, in the legacy display order
 * (`archfuturo.js:7-16`). One table feeds both exports, so they cannot drift.
 */
const ROLES: readonly (readonly [key: string, promptName: string])[] = [
  ['capitano', 'Capitano'],
  ['primo ufficiale', 'Primo ufficiale'],
  ['timoniere', 'Timoniere'],
  ['ufficiale tattico', 'Ufficiale tattico'],
  ['ufficiale scientifico', 'Ufficiale scientifico'],
  ['capo ingegnere', 'Capo ingegnere'],
  ['medico di bordo', 'Medico di bordo'],
  ['ufficiale alle comunicazioni', 'Ufficiale alle comunicazioni'],
];

/** The 8 role keys in the legacy order (`archfuturo.js:7-16`). */
export const ARCHIVE_ROLE_KEYS: readonly string[] = ROLES.map(([key]) => key);

/** Key to singular label, prompt content only: the UI labels live in the locales. */
export const ROLE_PROMPT_NAMES: Readonly<Record<string, string>> = Object.fromEntries(ROLES);

/**
 * Free-text synonyms in the legacy match order: the first pattern that fits a
 * normalised text wins, so «vice» is a first officer before anything else
 * (`archfuturo.js:24-26`).
 */
const ROLE_SYNONYMS: readonly (readonly [pattern: RegExp, key: string])[] = [
  [/capitan/, 'capitano'],
  [/^(primo|prima)|vice|comandante in seconda/, 'primo ufficiale'],
  [/timon|pilot/, 'timoniere'],
  [/tattic|sicurezz/, 'ufficiale tattico'],
  [/scien/, 'ufficiale scientifico'],
  [/ingegn|macchin/, 'capo ingegnere'],
  [/medic|dottor|infermer/, 'medico di bordo'],
  [/comunicaz|lingu|segnal/, 'ufficiale alle comunicazioni'],
];

/**
 * Normalises a free-text role («Prima ufficiale», «pilota») to one of the
 * eight keys, or to an empty string when it matches none (`archfuturo.js:22-27`).
 */
export function archRoleKey(text: string | null | undefined): string {
  const folded = normName(text);
  return ROLE_SYNONYMS.find(([pattern]) => pattern.test(folded))?.[1] ?? '';
}
