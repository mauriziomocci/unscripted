import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSheet } from './parseHelpers';

const FIXTURES = new URL('../fixtures/characters/presente/', import.meta.url);
const FILES = readdirSync(FIXTURES).filter((name) => name.endsWith('.md'));

describe('the present-time character sheets', () => {
  it('are the 16 of the pack', () => {
    expect(FILES).toHaveLength(16);
  });

  it.each(FILES)('%s parses with a name, a sex, an age and recognised sections', (file) => {
    const text = readFileSync(new URL(file, FIXTURES), 'utf8');
    const parsed = parseSheet(text, file);
    const heading = /^# (.+)$/m.exec(text)?.[1];
    const age = Number(/^Età: (\d+)/m.exec(text)?.[1]);

    expect(parsed.input.name).toBe(heading);
    expect(parsed.input.sex).toMatch(/^[mf]$/);
    expect(parsed.input.age).toBe(Math.min(95, Math.max(3, age)));
    expect(parsed.recognisedSections).toBeGreaterThanOrEqual(1);
    expect(parsed.input.short).not.toBe('');
    expect(Object.keys(parsed.input.sections ?? {})).toEqual(
      expect.arrayContaining(['identita', 'storia', 'carattere']),
    );
    expect(parsed.input.secrets?.length).toBeGreaterThan(0);
    expect(parsed.input.pendingRelations?.length).toBeGreaterThan(0);
  });
});
