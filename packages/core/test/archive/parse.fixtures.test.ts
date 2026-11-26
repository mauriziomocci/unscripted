import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacterFile } from '../../src/archive/parse';

const FIXTURES = new URL('../fixtures/characters/presente/', import.meta.url);
const FILES = readdirSync(FIXTURES).filter((name) => name.endsWith('.md'));

describe('the present-time character sheets', () => {
  it('are the 16 of the pack', () => {
    expect(FILES).toHaveLength(16);
  });

  it.each(FILES)('%s parses with a name, a sex, an age and recognised sections', (file) => {
    const text = readFileSync(new URL(file, FIXTURES), 'utf8');
    const parsed = parseCharacterFile(text, file);
    const heading = /^# (.+)$/m.exec(text)?.[1];
    const age = Number(/^Età: (\d+)/m.exec(text)?.[1]);

    expect(parsed.error).toBeUndefined();
    expect(parsed.character.name).toBe(heading);
    expect(parsed.character.sex).toMatch(/^[mf]$/);
    expect(parsed.character.age).toBe(Math.min(95, Math.max(3, age)));
    expect(parsed.recognisedSections).toBeGreaterThanOrEqual(1);
    expect(parsed.character.short).not.toBe('');
    expect(Object.keys(parsed.character.sections ?? {})).toEqual(
      expect.arrayContaining(['identita', 'storia', 'carattere']),
    );
    expect(parsed.character.secrets?.length).toBeGreaterThan(0);
    expect(parsed.character.pendingRelations?.length).toBeGreaterThan(0);
  });
});
