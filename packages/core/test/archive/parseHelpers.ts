import { parseCharacterFile, type ParsedCharacterFile } from '../../src/archive/parse';
import { NOW_MS } from './planners/fixtures';

/** The clock the parser dates its origin label with. */
export const CLOCK = { now: () => NOW_MS, perfNow: () => 0 };

/** Reads a file with the test clock. */
export function parse(text: string, fileName = 'x.md'): ParsedCharacterFile {
  return parseCharacterFile(text, fileName, CLOCK);
}

/** Reads a file that must come out as a sheet; fails the test otherwise. */
export function parseSheet(
  text: string,
  fileName = 'x.md',
): Extract<ParsedCharacterFile, { kind: 'character' }> {
  const parsed = parse(text, fileName);
  if (parsed.kind !== 'character') throw new Error(`expected a sheet, got ${parsed.kind}`);
  return parsed;
}
