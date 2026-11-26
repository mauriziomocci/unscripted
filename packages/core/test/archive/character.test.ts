import { describe, expect, it } from 'vitest';
import {
  CharacterInputSchema,
  CharacterSchema,
  CharacterSnapshotSchema,
} from '../../src/archive/character';

const SECTION_KEYS = [
  'identita',
  'storia',
  'carattere',
  'valori',
  'paure',
  'parlata',
  'relazioni_stile',
  'altro',
];

function validCharacter(): Record<string, unknown> {
  return {
    schema: 'personaggio/1',
    id: '3f0c1b52-6a43-4b4e-9d57-0c6f3a1e2b11',
    version: 1,
    revision: 1,
    updated: '2026-11-26T10:00:00.000Z',
    name: 'Ada',
    sex: 'f',
    age: 34,
    status: 'vivo',
  };
}

describe('CharacterSchema round trip', () => {
  it('keeps unknown keys at the root and inside every nested object', () => {
    const record = {
      ...validCharacter(),
      futureRoot: { deep: [1, 2] },
      sections: { identita: 'x', futureSection: 'y' },
      relations: [{ to: 'b', type: 'amico', int: 3, view: 'v', futureRel: true }],
      origin: { env: 'romanzo', futureOrigin: 1 },
      lives: [{ death: { day: 3, futureDeath: 1 }, futureLife: 1 }],
      venture: { missions: [], log: [], medals: [], futureVenture: 1 },
      novels: [{ title: 'T', series: 's', volume: 1, fate: 'f', date: 'd', futureNovel: 1 }],
    };
    expect(CharacterSchema.parse(record)).toEqual(record);
  });
});

describe('CharacterSchema prototype keys', () => {
  const poisoned = (key: string): unknown =>
    JSON.parse(`{"schema":"personaggio/1","sections":{"a":[{"${key}":{"x":1}}]}}`);

  it.each(['__proto__', 'constructor', 'prototype'])('refuses %s at any depth', (key) => {
    expect(CharacterSchema.safeParse(poisoned(key)).success).toBe(false);
    expect(CharacterSchema.safeParse({ ...validCharacter(), [key]: {} }).success).toBe(false);
    const nested = { ...validCharacter(), origin: { deep: [{ [key]: 1 }] } };
    expect(CharacterSchema.safeParse(nested).success).toBe(false);
  });

  it('refuses an own __proto__ key parsed from JSON, which zod alone would let through', () => {
    const record = JSON.parse(
      JSON.stringify(validCharacter()).replace('{', '{"__proto__":{"x":1},'),
    ) as unknown;
    expect(CharacterSchema.safeParse(record).success).toBe(false);
  });
});

describe('CharacterSchema values', () => {
  it('accepts only m and f as sex', () => {
    expect(CharacterSchema.safeParse({ ...validCharacter(), sex: 'f' }).success).toBe(true);
    expect(CharacterSchema.safeParse({ ...validCharacter(), sex: 'x' }).success).toBe(false);
  });

  it.each([-3, 0, 999, 100_000])('accepts the integer age %d', (age) => {
    expect(CharacterSchema.safeParse({ ...validCharacter(), age }).success).toBe(true);
  });

  it('refuses a fractional age', () => {
    expect(CharacterSchema.safeParse({ ...validCharacter(), age: 34.5 }).success).toBe(false);
  });

  it('accepts the eight sections, with no length cap', () => {
    const sections = Object.fromEntries(SECTION_KEYS.map((key) => [key, 'x'.repeat(50_000)]));
    expect(CharacterSchema.safeParse({ ...validCharacter(), sections }).success).toBe(true);
  });

  it('accepts secrets and goals with no count or length cap', () => {
    const many = Array.from({ length: 500 }, (_, i) => `item ${String(i)} ${'y'.repeat(1000)}`);
    const record = { ...validCharacter(), secrets: many, goals: many };
    expect(CharacterSchema.safeParse(record).success).toBe(true);
  });

  it('accepts era, role and style as free strings', () => {
    const record = { ...validCharacter(), era: 'romanzo', role: 'capitano', style: 'laconico' };
    expect(CharacterSchema.safeParse(record).success).toBe(true);
  });

  it('refuses a wrong type inside a key it knows', () => {
    expect(CharacterSchema.safeParse({ ...validCharacter(), tags: 'not-a-list' }).success).toBe(
      false,
    );
    expect(CharacterSchema.safeParse({ ...validCharacter(), status: 'sleeping' }).success).toBe(
      false,
    );
  });
});

describe('the derived character schemas', () => {
  const STORE_KEYS = ['id', 'legacyId', 'version', 'revision'];
  const inputShape = CharacterInputSchema.out.shape;
  const snapshotShape = CharacterSnapshotSchema.out.shape;

  it('leaves the store-owned keys out of CharacterInputSchema', () => {
    for (const key of STORE_KEYS) {
      expect(inputShape).not.toHaveProperty(key);
    }
  });

  it('makes updated optional in the input, because the planners set it from the Clock', () => {
    const input = Object.fromEntries(
      Object.entries(validCharacter()).filter(([key]) => !['updated', ...STORE_KEYS].includes(key)),
    );
    expect(CharacterInputSchema.safeParse(input).success).toBe(true);
  });

  it('leaves only revision out of CharacterSnapshotSchema', () => {
    expect(snapshotShape).not.toHaveProperty('revision');
    for (const key of ['id', 'legacyId', 'version', 'updated']) {
      expect(snapshotShape).toHaveProperty(key);
    }
  });

  it('still refuses prototype keys in the input and the snapshot', () => {
    const poisoned = JSON.parse('{"schema":"personaggio/1","a":{"__proto__":{}}}') as unknown;
    expect(CharacterInputSchema.safeParse(poisoned).success).toBe(false);
    expect(CharacterSnapshotSchema.safeParse(poisoned).success).toBe(false);
  });
});
