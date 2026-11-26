import { describe, expect, it } from 'vitest';
import { parse, parseSheet } from './parseHelpers';

/** The legacy message, verbatim (`archui.js:82`). */
const TOO_LONG = 'Il file è troppo lungo (oltre 200.000 caratteri).';

describe('parseCharacterFile limits (archui.js:78-82)', () => {
  it('cuts a section at 20,000 characters', () => {
    const { input: character } = parseSheet(`# X\n## Storia\n${'a'.repeat(25000)}`, 'x.md');
    expect(character.sections?.storia).toBe('a'.repeat(20000));
  });

  it('cuts the joined text of a section, not each piece', () => {
    const text = `# X\n## Storia\n${'a'.repeat(15000)}\n## Passato\n${'b'.repeat(15000)}`;
    expect(parseSheet(text, 'x.md').input.sections?.storia).toHaveLength(20000);
  });

  it.each(['Segreti', 'Obiettivi'])('keeps at most 12 items of «%s»', (title) => {
    const items = Array.from({ length: 15 }, (_, i) => `- voce numero ${String(i + 1)}`);
    const { input: character } = parseSheet(['# X', `## ${title}`, ...items].join('\n'), 'x.md');
    const kept = title === 'Segreti' ? character.secrets : character.goals;
    expect(kept).toEqual(items.slice(0, 12).map((item) => item.slice(2)));
  });

  it('refuses a file over 200,000 characters with the legacy message and no content', () => {
    expect(parse(`# X\n${'a'.repeat(200001)}`, 'grande.md')).toEqual({
      kind: 'error',
      error: TOO_LONG,
    });
  });

  it('accepts a file of exactly 200,000 characters', () => {
    const text = `# X\n${'a'.repeat(199996)}`;
    expect(text).toHaveLength(200000);
    expect(parse(text, 'x.md').kind).toBe('character');
  });
});

describe('parseCharacterFile recognised and other sections (archui.js:71, 251)', () => {
  it('files an unrecognised heading under «altro» and flags it', () => {
    const parsed = parseSheet('# X\n## Hobby\ncalcio', 'x.md');
    expect(parsed.input.sections).toEqual({ altro: 'calcio' });
    expect(parsed.otherSections).toBe(1);
    expect(parsed.recognisedSections).toBe(0);
  });

  it('counts the headings that match a synonym and, apart, those that went to «Altro» (archui.js:251)', () => {
    const parsed = parseSheet(
      '# X\n## Carattere\na\n## Hobby\nb\n## Sport\nc\n## Segreti\n- uno solo',
      'x.md',
    );
    expect(parsed.recognisedSections).toBe(2);
    expect(parsed.otherSections).toBe(2);
  });

  it('files text before any heading under the story, as the legacy does, and counts it', () => {
    const parsed = parseSheet("# X\nUna riga libera.\n\nUn'altra.", 'x.md');
    expect(parsed.input.sections).toEqual({ storia: "Una riga libera.\n\nUn'altra." });
    expect(parsed.otherSections).toBe(0);
    expect(parsed.recognisedSections).toBe(1);
  });

  it('counts no «Altro» section on a sheet whose headings are all recognised', () => {
    expect(parseSheet('# X\n## Carattere\na', 'x.md').otherSections).toBe(0);
  });
});
