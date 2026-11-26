import { DEFAULT_AGE } from './blank';
import type { CharacterInput } from './character';
import { archEra } from './era';
import { archRoleKey } from './roles';
import { TEXT_SECTION_KEYS } from './sections';

/** The editor refused the save; `code` says why, so callers decide by it and never by the message. */
export class NormaliseError extends Error {
  readonly code: 'name_required';

  constructor(code: 'name_required', message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NormaliseError';
    this.code = code;
  }
}

const MIN_AGE = 3;
/** The age field of the editor allows 999 for novel characters, who can be aliens or robots (`archui.js:297`). */
const MAX_AGE_NOVEL = 999;
const MAX_AGE = 95;
const DEFAULT_RELATION_TYPE = 'conoscenti';

const withoutBrackets = (text: string): string => text.trim().replace(/[<>]/g, '');

function clampedAge(age: number, era: string): number {
  const max = era === 'romanzo' ? MAX_AGE_NOVEL : MAX_AGE;
  return Math.max(MIN_AGE, Math.min(max, age || DEFAULT_AGE));
}

/** Trims each known section and removes the empty ones; keys it does not know are left alone. */
function cleanSections(
  sections: CharacterInput['sections'],
): NonNullable<CharacterInput['sections']> {
  const unknown = Object.entries(sections ?? {}).filter(
    ([key]) => !(TEXT_SECTION_KEYS as readonly string[]).includes(key),
  );
  const known = TEXT_SECTION_KEYS.flatMap((key) => {
    const text = (sections?.[key] ?? '').trim();
    return text ? [[key, text] as const] : [];
  });
  return Object.fromEntries([...unknown, ...known]);
}

/** A list the editor shows as a text area: one item per line, trimmed, empty lines dropped. */
function cleanLines(items: readonly string[] | undefined): string[] {
  return (items ?? [])
    .flatMap((item) => item.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanRelations(
  relations: CharacterInput['relations'],
  selfId: string,
): NonNullable<CharacterInput['relations']> {
  return (relations ?? [])
    .filter((relation) => relation.to && relation.to !== selfId)
    .map((relation) => ({
      ...relation,
      type: relation.type.trim() || DEFAULT_RELATION_TYPE,
      int: relation.int ?? 0,
      view: (relation.view ?? '').trim(),
    }));
}

/**
 * What the editor's save does to a form before storing it (`archui.js:297-303`,
 * FR-016). `selfId` is the character's own id, needed to drop relations to
 * itself. Pure: the input is not changed. Throws `NormaliseError` when the name
 * is empty. A future character's role is mapped to one of the eight keys as the
 * editor's select shows it (`archui.js:269`), or emptied; a present or novel character has no role and no style (AM-07, AM2-06).
 */
export function normaliseEdit(input: CharacterInput, selfId: string): CharacterInput {
  const name = withoutBrackets(input.name);
  if (!name) throw new NormaliseError('name_required', 'Il nome è obbligatorio.');
  const era = archEra(input);
  const result: CharacterInput = {
    ...input,
    name,
    age: clampedAge(input.age, era),
    short: (input.short ?? '').trim(),
    era,
    sections: cleanSections(input.sections),
    secrets: cleanLines(input.secrets),
    goals: cleanLines(input.goals),
    relations: cleanRelations(input.relations, selfId),
  };
  if (era === 'futuro') {
    result.role = archRoleKey(input.role);
    result.style = withoutBrackets(input.style ?? '');
  } else {
    delete result.role;
    delete result.style;
  }
  return result;
}
