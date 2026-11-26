import { describe, expect, it } from 'vitest';
import { archEra } from '../../src/archive/era';

describe('archEra (archfuturo.js:29)', () => {
  it.each([
    [{ era: 'futuro' }, 'futuro'],
    [{ era: 'romanzo' }, 'romanzo'],
    [{ era: 'presente' }, 'presente'],
    [{ era: 'medioevo' }, 'presente'],
    [{}, 'presente'],
  ])('reads %j as %s', (character, era) => {
    expect(archEra(character)).toBe(era);
  });
});
