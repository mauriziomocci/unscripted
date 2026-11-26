import { describe, expect, it } from 'vitest';
import { hasPrototypeKey } from '../../src/archive/prototypeKeys';

function nested(depth: number, leaf: unknown): unknown {
  let value = leaf;
  for (let i = 0; i < depth; i += 1) {
    value = { next: value };
  }
  return value;
}

describe('hasPrototypeKey', () => {
  it('finds each forbidden key as an own key, at the root, in objects and in arrays', () => {
    expect(hasPrototypeKey(JSON.parse('{"__proto__":{}}'))).toBe(true);
    expect(hasPrototypeKey({ constructor: 1 })).toBe(true);
    expect(hasPrototypeKey({ list: [{ ok: 1 }, { prototype: 1 }] })).toBe(true);
  });

  it('passes ordinary data, including values that merely contain the words', () => {
    expect(hasPrototypeKey({ name: '__proto__', tags: ['constructor'], n: 1, z: null })).toBe(
      false,
    );
    expect(hasPrototypeKey('text')).toBe(false);
    expect(hasPrototypeKey(null)).toBe(false);
  });

  it('does not overflow the stack on a document nested 100000 levels deep', () => {
    expect(hasPrototypeKey(nested(100_000, { ok: 1 }))).toBe(false);
    expect(hasPrototypeKey(nested(100_000, { constructor: 1 }))).toBe(true);
  });
});
