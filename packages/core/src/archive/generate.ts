import { TEXT as GENERATOR_TEMPLATE } from '../prompts/it/archive-generate';
import type { Character } from './character';
import { archEra } from './era';
import { ROLE_PROMPT_NAMES, archRoleKey } from './roles';

/** The two tones of the generator dialog, in the legacy order (`archfuturo.js:69`); their labels belong to the UI locales. */
export const GENERATOR_TONE_KEYS = ['serio', 'comico'] as const;

/** What the generator dialog sends, exactly what `archGenerate` reads (`archfuturo.js:144`). */
export interface GeneratorOptions {
  readonly role: string;
  readonly sex: 'm' | 'f' | '';
  readonly tone: (typeof GENERATOR_TONE_KEYS)[number];
  /** Empty means the model chooses a kind of officer. */
  readonly style: string;
  /** Empty means no trait line. */
  readonly trait: string;
}

const STYLE_LEFT_TO_MODEL = 'scegli tu un tipo di ufficiale diverso da quelli già presenti';
const SEX_WORDS = { f: 'donna', m: 'uomo', '': 'scegli tu' } as const;
const TONE_WORDS = {
  comico: 'comico: un disadattato simpatico, ma competente quando serve',
  serio: 'serio e drammatico',
} as const;
const NO_CREW = 'nessuno';
const NO_ROLE = 'senza ruolo';

/** The role as the prompt names it: the lower-case label of a known role, the raw text untouched otherwise (`archfuturo.js:71`). */
function roleName(role: string): string {
  return ROLE_PROMPT_NAMES[role]?.toLowerCase() ?? role;
}

/** Future characters still alive, as «Name (role)» (`archfuturo.js:71`). */
function crewNames(crew: readonly Character[]): string {
  const names = crew
    .filter((member) => archEra(member) === 'futuro' && member.status !== 'deceduto')
    .map((member) => `${member.name} (${archRoleKey(member.role) || NO_ROLE})`);
  return names.join(', ') || NO_CREW;
}

/**
 * Builds the prompt of the «Genera» dialog (`archGenPrompt`, `archfuturo.js:70-108`):
 * the Markdown asset with its placeholders filled by the legacy conditionals.
 * One pass over the template, so a value that looks like a placeholder or a
 * replacement pattern is inserted as plain text.
 */
export function buildGeneratorPrompt(
  options: GeneratorOptions,
  crew: readonly Character[],
): string {
  const values: Readonly<Record<string, string>> = {
    roleName: roleName(options.role),
    style: options.style || STYLE_LEFT_TO_MODEL,
    traitLine: options.trait ? `TRATTO DA INCLUDERE: ${options.trait}\n` : '',
    sex: SEX_WORDS[options.sex],
    tone: TONE_WORDS[options.tone],
    crew: crewNames(crew),
  };
  return GENERATOR_TEMPLATE.replace(
    /\{(\w+)\}/g,
    (placeholder, key: string) => values[key] ?? placeholder,
  );
}

/** The distinct styles already used for a role, in the order met, which the dialog lists (`archfuturo.js:127`). */
export function stylesForRole(crew: readonly Character[], role: string): readonly string[] {
  const styles = crew
    .filter((member) => archRoleKey(member.role) === role && member.style)
    .map((member) => member.style ?? '');
  return [...new Set(styles)];
}
