/** What {@link extractJson} found: the first JSON object or array of a text, or nothing. */
export type ExtractedJson = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

const CLOSER_OF: ReadonlyMap<string, string> = new Map([
  ['{', '}'],
  ['[', ']'],
]);
const CLOSERS: ReadonlySet<string> = new Set(CLOSER_OF.values());

/** Index of the quote that ends the string opened at `open`, or -1 when the text ends first. */
function findStringEnd(text: string, open: number): number {
  for (let i = open + 1; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (char === '\\') {
      i += 1; // the escaped character, a quote included, never ends the string
    } else if (char === '"') {
      return i;
    }
  }
  return -1;
}

/**
 * Index of the bracket that closes the one at `start`, or -1 when the text
 * ends first or the brackets do not match. Strings are skipped whole, so a
 * bracket inside one does not count.
 */
function findClosingIndex(text: string, start: number): number {
  const expected: string[] = [];
  for (let i = start; i < text.length; i += 1) {
    const char = text.charAt(i);
    const closer = CLOSER_OF.get(char);
    if (char === '"') {
      i = findStringEnd(text, i);
      if (i === -1) return -1;
    } else if (closer !== undefined) {
      expected.push(closer);
    } else if (CLOSERS.has(char)) {
      if (expected.pop() !== char) return -1;
      if (expected.length === 0) return i;
    }
  }
  return -1;
}

function tryParse(source: string): ExtractedJson {
  try {
    return { ok: true, value: JSON.parse(source) as unknown };
    // eslint-disable-next-line local/no-swallowed-error -- taste-exempt: JSON.parse reports bad input only by throwing, and the failure is mapped to the typed result { ok: false } that extractJson handles
  } catch {
    return { ok: false };
  }
}

/**
 * The first balanced JSON object or array in a text. Models wrap answers in
 * code fences and prose, so everything around the value is ignored. A stretch
 * that is balanced but not valid JSON (`{the note}`) is skipped and the search
 * goes on from the next opener, so a stray pair of braces in the prose before
 * the answer does not hide it. The first opener that never closes ends the
 * search with a failure, because a truncated answer must not be mistaken for
 * one of its inner values. Bare strings and numbers are not answers and are
 * never returned.
 */
export function extractJson(text: string): ExtractedJson {
  for (let start = 0; start < text.length; start += 1) {
    if (!CLOSER_OF.has(text.charAt(start))) continue;
    const end = findClosingIndex(text, start);
    if (end === -1) return { ok: false }; // a cut-off answer must not yield one of its inner values
    const parsed = tryParse(text.slice(start, end + 1));
    if (parsed.ok) return parsed;
    start = end; // resume after the failed stretch: its inner openers, strings included, are not answers
  }
  return { ok: false };
}
