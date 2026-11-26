import { BACKOFF_SCHEDULES } from '../llm/backoff';
import type { LlmClient } from '../llm/request';
import { callWithRetries } from '../llm/retry';
import { TEXT as GENERATOR_TEMPLATE } from '../prompts/it/archive-generate';
import type { Scheduler } from '../time/ports';
import type { Character, CharacterInput } from './character';
import type { ArchiveDeps } from './deps';
import { archEra } from './era';
import { generatedOrigin } from './origin';
import { parseCharacterFile } from './parse';
import { resolveOne } from './planners/pending';
import { omitKeys } from './planners/input';
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

/** A generated sheet is a page or two: shorter is a refusal, longer is not what was asked (`archfuturo.js:120`). */
const MIN_SHEET_LENGTH = 200;
const MAX_SHEET_LENGTH = 20_000;
/** The name a sheet gets from its file name when it holds none: `generata.md` (`archfuturo.js:122`). */
const NAMELESS_SHEET_NAME = 'generata';
const MAX_NAME_LENGTH = 40;
const INVALID_SHEET_MESSAGE = 'La scheda generata non è valida, riprova.';
const NAMELESS_SHEET_MESSAGE = 'La scheda generata non ha un nome, riprova.';

type GeneratedCharacter = { character: CharacterInput } | { error: string };

/**
 * Reads the model's answer as untrusted data (`archGenParse`, `archfuturo.js:119-124`):
 * a string sheet of bounded length, parsed by the same parser as a file, whose
 * name is required. The result is an editor preview, never saved.
 */
export function parseGeneratedCharacter(
  answer: unknown,
  role: string,
  clock: ArchiveDeps['clock'],
): GeneratedCharacter {
  const sheet = (answer as { scheda?: unknown } | null)?.scheda;
  if (
    typeof sheet !== 'string' ||
    sheet.length < MIN_SHEET_LENGTH ||
    sheet.length > MAX_SHEET_LENGTH
  ) {
    return { error: INVALID_SHEET_MESSAGE };
  }
  const parsed = parseCharacterFile(sheet, `${NAMELESS_SHEET_NAME}.md`, clock);
  if (
    parsed.kind !== 'character' ||
    !parsed.input.name ||
    parsed.input.name === NAMELESS_SHEET_NAME
  ) {
    return { error: NAMELESS_SHEET_MESSAGE };
  }
  const name = parsed.input.name.replace(/[<>]/g, '').slice(0, MAX_NAME_LENGTH);
  return {
    character: { ...parsed.input, era: 'futuro', role, name, origin: generatedOrigin(clock) },
  };
}

/** What a generation needs beyond the archive's own deps: a timer for the pauses between retries. */
export interface GeneratorDeps extends ArchiveDeps {
  readonly scheduler: Scheduler;
}

const PREVIEW_ID = 'preview';

/** Links the sheet's relations by name to the characters that exist, as the legacy does before the editor opens (`archfuturo.js:148`). */
function withLinksResolved(input: CharacterInput, everyone: readonly Character[]): CharacterInput {
  const holder: Character = { ...input, id: PREVIEW_ID, version: 1, revision: 1, updated: '' };
  const resolved = resolveOne(holder, everyone);
  return omitKeys(resolved, new Set(['id', 'version', 'revision', 'updated'])) as CharacterInput;
}

/**
 * The «✨ Genera» call: builds the prompt, asks the model once (with the
 * retries of a rate limit), and returns the sheet as an editor preview, or the
 * refusal message of a bad answer. It never saves; `crew` is the whole archive.
 * An error of the model call reaches the caller as the `LlmError` it is.
 */
export async function generateCharacter(
  llm: LlmClient,
  options: GeneratorOptions,
  crew: readonly Character[],
  deps: GeneratorDeps,
): Promise<GeneratedCharacter> {
  const prompt = buildGeneratorPrompt(options, crew);
  const { value } = await callWithRetries(
    (attempt) => llm.complete({ kind: 'archive-generate', tier: 'main', prompt, attempt }),
    { schedule: BACKOFF_SCHEDULES.archiveGenerate, scheduler: deps.scheduler },
  );
  const generated = parseGeneratedCharacter(value, options.role, deps.clock);
  return 'character' in generated
    ? { character: withLinksResolved(generated.character, crew) }
    : generated;
}
