import { describe, expect, it } from 'vitest';
import { parseCharacterFile } from '../../src/archive/parse';

/** The legacy message, verbatim (`archui.js:82`). */
const TOO_LONG = 'Il file è troppo lungo (oltre 200.000 caratteri).';

describe('parseCharacterFile limits (archui.js:78-82)', () => {
  it('cuts a section at 20,000 characters', () => {
    const { character } = parseCharacterFile(`# X\n## Storia\n${'a'.repeat(25000)}`, 'x.md');
    expect(character.sections?.storia).toBe('a'.repeat(20000));
  });

  it('cuts the joined text of a section, not each piece', () => {
    const text = `# X\n## Storia\n${'a'.repeat(15000)}\n## Passato\n${'b'.repeat(15000)}`;
    expect(parseCharacterFile(text, 'x.md').character.sections?.storia).toHaveLength(20000);
  });

  it.each(['Segreti', 'Obiettivi'])('keeps at most 12 items of «%s»', (title) => {
    const items = Array.from({ length: 15 }, (_, i) => `- voce numero ${String(i + 1)}`);
    const { character } = parseCharacterFile(['# X', `## ${title}`, ...items].join('\n'), 'x.md');
    const kept = title === 'Segreti' ? character.secrets : character.goals;
    expect(kept).toEqual(items.slice(0, 12).map((item) => item.slice(2)));
  });

  it('refuses a file over 200,000 characters with the legacy message and no content', () => {
    const parsed = parseCharacterFile(`# X\n${'a'.repeat(200001)}`, 'grande.md');
    expect(parsed.error).toBe(TOO_LONG);
    expect(parsed.recognisedSections).toBe(0);
    expect(parsed.character.sections).toEqual({});
  });

  it('accepts a file of exactly 200,000 characters', () => {
    const text = `# X\n${'a'.repeat(199996)}`;
    expect(text).toHaveLength(200000);
    expect(parseCharacterFile(text, 'x.md').error).toBeUndefined();
  });
});

describe('parseCharacterFile recognised and other sections (archui.js:73, 307)', () => {
  it('files an unrecognised heading under «altro» and flags it', () => {
    const parsed = parseCharacterFile('# X\n## Hobby\ncalcio', 'x.md');
    expect(parsed.character.sections).toEqual({ altro: 'calcio' });
    expect(parsed.toOther).toBe(true);
    expect(parsed.recognisedSections).toBe(0);
  });

  it('counts only the headings that match a synonym', () => {
    const parsed = parseCharacterFile(
      '# X\n## Carattere\na\n## Hobby\nb\n## Segreti\n- uno solo',
      'x.md',
    );
    expect(parsed.recognisedSections).toBe(2);
    expect(parsed.toOther).toBe(true);
  });

  it('files text before any heading under the story, as the legacy does, and counts it', () => {
    const parsed = parseCharacterFile("# X\nUna riga libera.\n\nUn'altra.", 'x.md');
    expect(parsed.character.sections).toEqual({ storia: "Una riga libera.\n\nUn'altra." });
    expect(parsed.toOther).toBe(false);
    expect(parsed.recognisedSections).toBe(1);
  });

  it('does not flag a sheet whose headings are all recognised', () => {
    expect(parseCharacterFile('# X\n## Carattere\na', 'x.md').toOther).toBe(false);
  });
});
