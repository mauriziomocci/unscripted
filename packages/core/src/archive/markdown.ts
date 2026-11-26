import type { CharacterInput } from './character';
import { archEra } from './era';

/** The seven free-text sections a sheet writes, in the legacy order, with the heading the parser reads back (`archui.js:4-12`). */
const SECTION_TITLES: readonly (readonly [key: string, title: string])[] = [
  ['identita', 'Identità e aspetto'],
  ['storia', 'Storia di vita'],
  ['carattere', 'Carattere'],
  ['valori', 'Valori, convinzioni, fissazioni'],
  ['paure', 'Paure e punti deboli'],
  ['parlata', 'Modo di parlare'],
  ['relazioni_stile', 'Come tratta gli altri'],
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
    ...SECTION_TITLES.flatMap(([key, title]) => block(title, textOf(sections[key]))),
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
