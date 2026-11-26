import { describe, expect, it } from 'vitest';
import { GameEventSchema } from '../../src/events/gameEvent';

const VALID_EVENT = {
  schema_version: 1,
  seq: 0,
  kind: 'speech',
  gameTime: 12.5,
  actor: 'c_ada',
  payload: { text: 'hello' },
};

describe('GameEventSchema', () => {
  it('accepts a complete event', () => {
    expect(GameEventSchema.parse(VALID_EVENT)).toEqual(VALID_EVENT);
  });

  it('accepts a null actor, for events no character caused', () => {
    expect(GameEventSchema.parse({ ...VALID_EVENT, actor: null }).actor).toBeNull();
  });

  it('accepts any payload, including an explicit null', () => {
    expect(GameEventSchema.parse({ ...VALID_EVENT, payload: null }).payload).toBeNull();
    expect(GameEventSchema.parse({ ...VALID_EVENT, payload: [1, 2] }).payload).toEqual([1, 2]);
  });

  it.each(Object.keys(VALID_EVENT))('refuses an event without %s', (field) => {
    const incomplete = Object.fromEntries(
      Object.entries(VALID_EVENT).filter(([key]) => key !== field),
    );
    expect(GameEventSchema.safeParse(incomplete).success).toBe(false);
  });

  it('refuses a negative seq', () => {
    expect(GameEventSchema.safeParse({ ...VALID_EVENT, seq: -1 }).success).toBe(false);
  });

  it.each([
    ['a fractional seq', { seq: 1.5 }],
    ['a zero schema_version', { schema_version: 0 }],
    ['an empty kind', { kind: '' }],
    ['a game time that is not a number', { gameTime: 'noon' }],
    ['an actor that is a number', { actor: 7 }],
  ])('refuses %s', (_name, change) => {
    expect(GameEventSchema.safeParse({ ...VALID_EVENT, ...change }).success).toBe(false);
  });
});
