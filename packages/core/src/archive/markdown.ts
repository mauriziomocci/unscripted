import type { CharacterInput } from './character';
import { archEra, type ArchiveEra } from './era';

/**
 * The seven free-text sections a sheet writes, in the legacy order: the key,
 * the heading the parser reads back (`archui.js:4-12`) and the hint the
 * downloadable template prints under it (`archui.js:97-114`).
 */
const SHEET_SECTIONS: readonly (readonly [key: string, title: string, templateHint: string])[] = [
  ['identita', 'Identità e aspetto', "Chi è, che lavoro fa, com'è fatto, come si veste."],
  ['storia', 'Storia di vita', "Infanzia, famiglia, lavoro, gli eventi che l'hanno segnato."],
  ['carattere', 'Carattere', 'Pregi, difetti, come reagisce di solito.'],
  [
    'valori',
    'Valori, convinzioni, fissazioni',
    'In cosa crede, di cosa è convinto (anche se sbagliato), cosa non sopporta.',
  ],
  ['paure', 'Paure e punti deboli', 'Cosa lo spaventa, dove è vulnerabile.'],
  ['parlata', 'Modo di parlare', 'Lessico, intercalari, dialetto, tic verbali, tono.'],
  [
    'relazioni_stile',
    'Come tratta gli altri',
    'Con chi gli dà ragione, con chi gli dà torto, con chi comanda.',
  ],
];

export interface MarkdownOptions {
  /** Whether the sheet carries the character's secrets and goals, which the game keeps from the others. */
  readonly withSecrets: boolean;
  /**
   * Name of the character a relation points to. The record holds ids, the sheet
   * holds names (`archui.js:133`); a relation whose target has no name is left
   * out, as the legacy does for a character no longer in the archive.
   */
  readonly nameOf?: (id: string) => string | undefined;
}

function headerLines(character: CharacterInput): string[] {
  const lines = [
    `# ${character.name}`,
    `Età: ${String(character.age)}`,
    `Sesso: ${character.sex === 'f' ? 'donna' : 'uomo'}`,
  ];
  if (character.temper) lines.push(`Temperamento: ${character.temper}`);
  const era = archEra(character);
  if (era === 'romanzo') lines.push('Epoca: romanzo');
  if (era === 'futuro') {
    lines.push('Epoca: futuro');
    if (character.role) lines.push(`Ruolo preferito: ${character.role}`);
    if (character.style) lines.push(`Stile: ${character.style}`);
  }
  if (character.short) lines.push(`In breve: ${character.short}`);
  return lines;
}

/** A heading with its body, set apart by a blank line; nothing when the body is empty. */
function block(title: string, body: readonly string[]): string[] {
  return body.length > 0 ? ['', `## ${title}`, ...body] : [];
}

function listBlock(title: string, items: readonly string[] | undefined): string[] {
  return block(
    title,
    (items ?? []).map((item) => `- ${item}`),
  );
}

function relationLines(character: CharacterInput, nameOf: MarkdownOptions['nameOf']): string[] {
  return (character.relations ?? []).flatMap((relation) => {
    const name = nameOf?.(relation.to);
    if (name === undefined) return [];
    const view = relation.view ? `, "${relation.view}"` : '';
    return [`- ${name}: ${relation.type}, ${String(relation.int || 0)}${view}`];
  });
}

/**
 * Writes a character as a Markdown sheet (`archToMarkdown`, `archui.js:127-136`),
 * the format `parseCharacterFile` reads back. Era, role and style are written
 * only where they apply (AM-07, AM2-06). Pending relations are not written, as
 * in the legacy: they exist only until their target appears.
 */
export function characterToMarkdown(character: CharacterInput, options: MarkdownOptions): string {
  const sections = character.sections ?? {};
  const lines = [
    ...headerLines(character),
    ...SHEET_SECTIONS.flatMap(([key, title]) => block(title, textOf(sections[key]))),
    ...(options.withSecrets ? listBlock('Segreti', character.secrets) : []),
    ...(options.withSecrets ? listBlock('Obiettivi', character.goals) : []),
    ...block('Rapporti', relationLines(character, options.nameOf)),
    ...block('Altro', textOf(sections.altro)),
  ];
  return `${lines.join('\n')}\n`;
}

/** A section's text as the one body line it is, or no body when it is missing or empty. */
function textOf(text: unknown): string[] {
  return typeof text === 'string' && text ? [text] : [];
}

/** The lines an era adds to the template's header (`archui.js:92`). */
const TEMPLATE_ERA_LINES: Readonly<Record<ArchiveEra, readonly string[]>> = {
  presente: [],
  futuro: [
    'Epoca: futuro',
    'Ruolo preferito: capitano',
    'Stile: il tipo di ufficiale in poche parole',
  ],
  romanzo: ['Epoca: romanzo'],
};

const TEMPLATE_FILE_NAMES: Readonly<Record<ArchiveEra, string>> = {
  presente: 'modello-scheda-personaggio.md',
  futuro: 'modello-scheda-equipaggio.md',
  romanzo: 'modello-scheda-romanzo.md',
};

/** The three list sections at the end of the template, each with its one example line (`archui.js:115-125`). */
const TEMPLATE_LIST_SECTIONS: readonly (readonly [title: string, example: string])[] = [
  ['Segreti', '- un segreto per riga (lo sa solo lui)'],
  ['Obiettivi', '- cosa vuole ottenere, senza dirlo (uno per riga)'],
  ['Rapporti', '- Nome di un altro personaggio: ex partner, -2, "cosa pensa di lui/lei"'],
];

/**
 * The blank sheet a player downloads to fill in (`archTemplate`,
 * `archui.js:89-126`, file names `archui.js:210`), with the lines of its era.
 * It reads back through `parseCharacterFile` with all ten sections recognised.
 */
export function characterTemplate(era: ArchiveEra): { fileName: string; text: string } {
  const lines = [
    '# Nome e cognome',
    'Età: 40',
    'Sesso: uomo',
    'Temperamento: ironico',
    ...TEMPLATE_ERA_LINES[era],
    'In breve: una riga che lo descrive (è quella che si vede sulla scheda)',
    ...SHEET_SECTIONS.flatMap(([, title, hint]) => block(title, [`_${hint}_`])),
    ...TEMPLATE_LIST_SECTIONS.flatMap(([title, example]) => block(title, [example])),
  ];
  return { fileName: TEMPLATE_FILE_NAMES[era], text: `${lines.join('\n')}\n` };
}
