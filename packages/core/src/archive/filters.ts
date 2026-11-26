import type { Character } from './character';
import { archEra, type ArchiveEra } from './era';
import { normName } from './normName';

/** The four views of the archive list (`archui.js:232`). */
export type ArchiveFilter = 'vivi' | 'deceduti' | 'disattivati' | 'tutti';

type Listed = Pick<Character, 'status' | 'disabled'>;

/** Whether a character shows under a filter: a disabled one shows only under `disattivati` and `tutti` (`archui.js:232`). */
function matchesFilter(character: Listed, filter: ArchiveFilter): boolean {
  if (filter === 'tutti') return true;
  if (filter === 'disattivati') return character.disabled === true;
  return (
    character.disabled !== true && (filter === 'deceduti') === (character.status === 'deceduto')
  );
}

/** The characters a filter selects, in the order given. */
export function filterByStatus<T extends Listed>(
  characters: readonly T[],
  filter: ArchiveFilter,
): T[] {
  return characters.filter((character) => matchesFilter(character, filter));
}

/** The three numbers of the archive counter. */
export interface StatusCounts {
  /** Everyone not deceased, disabled characters included: the counter's «vivi» is not the filter's. */
  readonly alive: number;
  readonly deceased: number;
  readonly disabled: number;
}

/** The counter above the list (`archui.js:231`); the legacy shows «disattivati» only when it is not zero, which is the UI's call. */
export function countByStatus(characters: readonly Listed[]): StatusCounts {
  const deceased = characters.filter(({ status }) => status === 'deceduto').length;
  return {
    alive: characters.length - deceased,
    deceased,
    disabled: characters.filter(({ disabled }) => disabled === true).length,
  };
}

/** The characters of the home card that can still play, by era (`talk.js:37-38`). */
export function countByEra(
  characters: readonly (Listed & { readonly era?: string | undefined })[],
): Record<'present' | 'future' | 'novel', number> {
  const playable = characters.filter((c) => matchesFilter(c, 'vivi'));
  const inEra = (era: ArchiveEra): number => playable.filter((c) => archEra(c) === era).length;
  return { present: inEra('presente'), future: inEra('futuro'), novel: inEra('romanzo') };
}

type Searchable = Pick<Character, 'name' | 'short' | 'style' | 'tags' | 'era'>;

/**
 * The characters of an era whose name, short description, style or tags
 * contain the query, accents and case folded, sorted by name (`archui.js:233`).
 * The status filter is applied by the caller with `filterByStatus`.
 */
export function searchArchive<T extends Searchable>(
  characters: readonly T[],
  era: string,
  query: string,
): T[] {
  const wanted = normName(query);
  const text = (c: Searchable): string =>
    normName([c.name, c.short ?? '', c.style ?? '', (c.tags ?? []).join(' ')].join(' '));
  return characters
    .filter((c) => archEra(c) === era && (!wanted || text(c).includes(wanted)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The ids of characters whose name another character shares, for the «nome doppio» mark (`archui.js:237`). */
export function duplicateNameIds(
  characters: readonly Pick<Character, 'id' | 'name'>[],
): Set<string> {
  const idsByName = new Map<string, string[]>();
  for (const { id, name } of characters) {
    const key = normName(name);
    idsByName.set(key, [...(idsByName.get(key) ?? []), id]);
  }
  return new Set([...idsByName.values()].filter((ids) => ids.length > 1).flat());
}
