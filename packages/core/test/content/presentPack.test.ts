import { describe, expect, it } from 'vitest';
import { PRESENT_PACK } from '../../src/index';

describe('PRESENT_PACK', () => {
  it('holds the 16 characters of archpack.js, each with a distinct legacy id', () => {
    expect(PRESENT_PACK).toHaveLength(16);
    expect(new Set(PRESENT_PACK.map((character) => character.id)).size).toBe(16);
  });

  it('gives every character the first revision, which the legacy records lack', () => {
    expect(PRESENT_PACK.map((character) => character.revision)).toEqual(Array(16).fill(1));
  });
});
