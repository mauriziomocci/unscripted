import type { CharacterInput } from './character';
import { archRoleKey } from './roles';

/** A sheet read from a file: an editor preview, never stored as it is. */
export interface ParsedCharacterFile {
  /** Without the store-owned keys (`id`, `version`, `revision`) and without `updated`: the planners add them. */
  readonly character: CharacterInput;
  /** Headings filed under one of the nine known sections, for the «N sezioni riconosciute» note (`archui.js:307`). */
  readonly recognisedSections: number;
  /** Whether some heading was not recognised and its text went to «Altro». */
  readonly toOther: boolean;
  readonly error?: string;
}

/**
 * Heading synonyms in the legacy match order: the first pattern that fits a
 * heading wins, so «Storia di vita» is a story and not an identity
 * (`archui.js:15-17`). Italian and English spellings both work.
 */
const SECTION_SYNONYMS: readonly (readonly [key: string, pattern: RegExp])[] = [
  ['identita', /identit|aspetto|chi [eè]|chi sono|descrizione|look|appearance|identity/i],
  ['storia', /storia|biografi|passato|vita|background|history|infanzia/i],
  ['carattere', /caratter|personalit|temperament|personality/i],
  ['valori', /valori|convinzion|credenz|fissazion|ideolog|beliefs|values|opinion/i],
  ['paure', /paur|debol|fragil|fears|weak/i],
  ['parlata', /parla|linguagg|lessico|dialett|voce|speech|speaking/i],
  ['relazioni_stile', /tratta|altri|rapporto con gli|come si comporta|others/i],
  ['segreti', /segret|nasconde|non dice|secret/i],
  ['obiettivi', /obiettiv|scop|vuole|desider|goal/i],
  ['rapporti', /rapporti|relazioni|legami|conosce|relationships/i],
];

/** The keys of the record's `sections`, in the legacy order; the three list sections are not among them. */
const TEXT_SECTION_KEYS = [
  'identita',
  'storia',
  'carattere',
  'valori',
  'paure',
  'parlata',
  'relazioni_stile',
  'altro',
] as const;

/** Where a heading goes when no synonym fits; the text is kept, not used by the game. */
const OTHER_SECTION = 'altro';

/** Where text that comes before any heading goes (`archui.js:73`). */
const UNTITLED_TEXT_SECTION = 'storia';

const HEADING = /^(#{1,3})\s+(.+?)\s*$/;
const HEADER_LINE =
  /^\s*(nome|età|eta|sesso|temperamento|carattere in breve|in breve|epoca|ruolo preferito|ruolo|stile)\s*:\s*(.+)$/i;
/** A bullet or number in front of a list item. */
const LIST_MARK = /^\s*[-*\d.)]+\s*/;
/** `Name: type, intensity, "what they think"`, intensity and opinion optional (`archui.js:79`). */
const PENDING_RELATION = /^([^:]+):\s*([^,]+)(?:,\s*([-+−]?\d))?(?:,\s*["«“]?(.+?)["»”]?)?$/;
/** An italic line is the template's hint, not content (`archui.js:65`). */
const TEMPLATE_HINT = /^\s*_[^_]+_\s*$/gm;

/** A file longer than this is refused (`archui.js:82`): a sheet is a page or two, and the cap bounds the work a hostile file can cause. */
const MAX_FILE_LENGTH = 200_000;
/** One section is cut here (`archui.js:75`): longer text would crowd the prompt that carries it. */
const MAX_SECTION_LENGTH = 20_000;
/** Secrets and goals kept per sheet (`archui.js:76`), for the same reason. */
const MAX_LIST_ITEMS = 12;
/** The legacy message, verbatim (`archui.js:82`). */
const FILE_TOO_LONG_MESSAGE = 'Il file è troppo lungo (oltre 200.000 caratteri).';

const MIN_AGE = 3;
const MAX_AGE = 95;
const MAX_ROLE_LENGTH = 40;
const MAX_STYLE_LENGTH = 80;
const MAX_DERIVED_SHORT_LENGTH = 200;
const DEFAULT_AGE = 35;

type Draft = { -readonly [K in keyof CharacterInput]: CharacterInput[K] };

interface Outline {
  readonly title: string;
  readonly key: string;
}

/** What the reader has seen so far: the sheet being built, the open section and the text of each one. */
interface ReaderState {
  readonly draft: Draft;
  readonly outline: Outline[];
  readonly bodies: Record<string, string>;
  readonly buffer: string[];
  current: Outline | null;
}

/** The legacy blank sheet (`archBlank`, `archui.js:34`) without the keys the planners own. */
function blankDraft(): Draft {
  return {
    schema: 'personaggio/1',
    name: '',
    sex: 'm',
    age: DEFAULT_AGE,
    temper: '',
    short: '',
    tags: [],
    sections: {},
    secrets: [],
    goals: [],
    relations: [],
    status: 'vivo',
    life: 1,
    lives: [],
    origin: null,
    sessions: [],
  };
}

/**
 * One header line per key, each the matching branch of `archui.js:70`. A
 * handler returns the fields to set, so it has no effect of its own.
 */
const HEADER_FIELDS: Readonly<Record<string, (draft: Draft, value: string) => Partial<Draft>>> = {
  nome: (_draft, value) => ({ name: value }),
  età: (draft, value) => ({ age: clampAge(parseInt(value, 10) || draft.age) }),
  eta: (draft, value) => ({ age: clampAge(parseInt(value, 10) || draft.age) }),
  sesso: (_draft, value) => ({ sex: /^f|donna/i.test(value) ? 'f' : 'm' }),
  temperamento: (_draft, value) => ({ temper: value.toLowerCase() }),
  epoca: (_draft, value) => ({
    era: /^futur/i.test(value) ? 'futuro' : /^romanz/i.test(value) ? 'romanzo' : 'presente',
  }),
  'ruolo preferito': (_draft, value) => ({ role: roleOf(value) }),
  ruolo: (_draft, value) => ({ role: roleOf(value) }),
  stile: (_draft, value) => ({ style: value.slice(0, MAX_STYLE_LENGTH) }),
  'in breve': (_draft, value) => ({ short: value }),
  'carattere in breve': (_draft, value) => ({ short: value }),
};

/** The legacy parser clamps every age to 3-95, a novel character's too (`archui.js:70`, AM2-06). */
function clampAge(age: number): number {
  return Math.max(MIN_AGE, Math.min(MAX_AGE, age));
}

function roleOf(value: string): string {
  return archRoleKey(value) || value.slice(0, MAX_ROLE_LENGTH);
}

function sectionKeyOf(title: string): string {
  return SECTION_SYNONYMS.find(([, pattern]) => pattern.test(title))?.[0] ?? OTHER_SECTION;
}

/** Closes the open section: its text, without the template hints, joins what the same key already holds. */
function flushSection(state: ReaderState): void {
  if (state.current !== null) {
    const body = state.buffer.join('\n').replace(TEMPLATE_HINT, '').trim();
    const { key } = state.current;
    const previous = state.bodies[key];
    if (body) state.bodies[key] = previous === undefined ? body : `${previous}\n\n${body}`;
  }
  state.buffer.length = 0;
}

function openSection(state: ReaderState, title: string): void {
  flushSection(state);
  state.current = { title, key: sectionKeyOf(title) };
  state.outline.push(state.current);
}

/** A `#` heading names the sheet while it has no name; any other heading opens a section (`archui.js:66-67`). */
function readHeading(state: ReaderState, heading: RegExpExecArray): void {
  const [, level = '', title = ''] = heading;
  if (level === '#' && !state.draft.name) {
    state.draft.name = title.replace(/^nome:\s*/i, '').trim();
  } else {
    openSection(state, title);
  }
}

/** Text before any heading goes to the story, as one untitled section (`archui.js:73`). */
function addBodyLine(state: ReaderState, line: string): void {
  if (state.current === null) {
    if (!line.trim()) return;
    state.current = { title: '(testo senza titolo)', key: UNTITLED_TEXT_SECTION };
    state.outline.push(state.current);
  }
  state.buffer.push(line);
}

/** Reads one line; the order of the checks is the legacy one (`archui.js:66-75`). */
function readLine(state: ReaderState, line: string): void {
  const heading = HEADING.exec(line);
  if (heading) {
    readHeading(state, heading);
    return;
  }
  const field = state.current === null ? HEADER_LINE.exec(line) : null;
  if (field) {
    const handler = HEADER_FIELDS[(field[1] ?? '').toLowerCase()];
    Object.assign(state.draft, handler?.(state.draft, (field[2] ?? '').trim()));
    return;
  }
  addBodyLine(state, line);
}

/** A list section as items: bullets and numbers stripped, items of two characters or less dropped (`archui.js:76`). */
function listOf(text: string | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((item) => item.replace(LIST_MARK, '').trim())
    .filter((item) => item.length > 2);
}

function pendingRelationOf(
  item: string,
): { name: string; type: string; int: number; view: string } | null {
  const match = PENDING_RELATION.exec(item);
  if (!match) return null;
  return {
    name: (match[1] ?? '').trim(),
    type: (match[2] ?? '').trim(),
    int: parseInt((match[3] ?? '0').replace('−', '-'), 10) || 0,
    view: (match[4] ?? '').trim(),
  };
}

/** The first sentence of the first of carattere, identita, storia that exists (`archui.js:81`). */
function derivedShort(sections: Readonly<Record<string, string>>): string {
  const source = sections.carattere || sections.identita || sections.storia || '';
  return (source.split(/(?<=[.!?])\s/)[0] ?? '').slice(0, MAX_DERIVED_SHORT_LENGTH);
}

function fileNameWithoutExtension(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

/** Moves what the reader collected into the sheet, once the whole text has been read. */
function completeDraft(state: ReaderState, fileName: string): void {
  const { draft, bodies } = state;
  const sections: Record<string, string> = {};
  for (const key of TEXT_SECTION_KEYS) {
    const body = bodies[key];
    if (body) sections[key] = body.slice(0, MAX_SECTION_LENGTH);
  }
  draft.sections = sections;
  if (bodies.segreti) draft.secrets = listOf(bodies.segreti).slice(0, MAX_LIST_ITEMS);
  if (bodies.obiettivi) draft.goals = listOf(bodies.obiettivi).slice(0, MAX_LIST_ITEMS);
  if (bodies.rapporti) {
    draft.pendingRelations = listOf(bodies.rapporti).flatMap(
      (item) => pendingRelationOf(item) ?? [],
    );
  }
  if (!draft.name) draft.name = fileNameWithoutExtension(fileName) || 'Senza nome';
  if (!draft.short) draft.short = derivedShort(sections);
}

/**
 * Reads a Markdown or text character sheet (`archParse`, `archui.js:54-84`):
 * header lines (`Età: 35`), then `#` headings that name a section by its
 * synonyms, with the legacy order of precedence and messages. The result is a
 * preview for the editor; saving it goes through the create planner, which
 * gives it an id, a version and a date. A `.json` file is not read here: the
 * import planner takes `archivio/1` files and the editor takes one sheet.
 */
export function parseCharacterFile(text: string, fileName: string): ParsedCharacterFile {
  if (text.length > MAX_FILE_LENGTH) {
    const draft = { ...blankDraft(), name: fileNameWithoutExtension(fileName) || 'Senza nome' };
    return {
      character: draft,
      recognisedSections: 0,
      toOther: false,
      error: FILE_TOO_LONG_MESSAGE,
    };
  }
  const state: ReaderState = {
    draft: blankDraft(),
    outline: [],
    bodies: {},
    buffer: [],
    current: null,
  };
  for (const line of text.replace(/\r/g, '').split('\n')) readLine(state, line);
  flushSection(state);
  completeDraft(state, fileName);
  return {
    character: state.draft,
    recognisedSections: state.outline.filter(({ key }) => key !== OTHER_SECTION).length,
    toOther: state.outline.some(({ key }) => key === OTHER_SECTION),
  };
}
