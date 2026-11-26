import { describe, expect, it } from 'vitest';
import { normName } from '../../src/archive/normName';
import { ARCHIVE_ROLE_KEYS, ROLE_PROMPT_NAMES, archRoleKey } from '../../src/archive/roles';

describe('normName (archui.js:18)', () => {
  it('folds accents and case and collapses whitespace', () => {
    expect(normName('  Àndrea   DÈ  Luca ')).toBe('andrea de luca');
  });

  it.each([null, undefined, ''])('gives an empty string for %s', (value) => {
    expect(normName(value)).toBe('');
  });
});

describe('ARCHIVE_ROLE_KEYS (archfuturo.js:7-16)', () => {
  it('holds the 8 keys in the legacy order', () => {
    expect(ARCHIVE_ROLE_KEYS).toEqual([
      'capitano',
      'primo ufficiale',
      'timoniere',
      'ufficiale tattico',
      'ufficiale scientifico',
      'capo ingegnere',
      'medico di bordo',
      'ufficiale alle comunicazioni',
    ]);
  });
});

describe('ROLE_PROMPT_NAMES (archfuturo.js:7-16, third column)', () => {
  it('maps each key to the singular label the generator prompt prints', () => {
    expect(ROLE_PROMPT_NAMES).toEqual({
      capitano: 'Capitano',
      'primo ufficiale': 'Primo ufficiale',
      timoniere: 'Timoniere',
      'ufficiale tattico': 'Ufficiale tattico',
      'ufficiale scientifico': 'Ufficiale scientifico',
      'capo ingegnere': 'Capo ingegnere',
      'medico di bordo': 'Medico di bordo',
      'ufficiale alle comunicazioni': 'Ufficiale alle comunicazioni',
    });
  });
});

describe('archRoleKey (archfuturo.js:22-27)', () => {
  it.each(ARCHIVE_ROLE_KEYS.map((key) => [key]))('keeps the key %s', (key) => {
    expect(archRoleKey(key)).toBe(key);
  });

  it.each([
    ['Capitano', 'capitano'],
    ['Prima ufficiale', 'primo ufficiale'],
    ['vice comandante', 'primo ufficiale'],
    ['Comandante in seconda', 'primo ufficiale'],
    ['pilota', 'timoniere'],
    ['Ufficiale della sicurezza', 'ufficiale tattico'],
    ['Scienziata', 'ufficiale scientifico'],
    ['macchinista', 'capo ingegnere'],
    ['Dottoressa', 'medico di bordo'],
    ['Capo infermeria', 'medico di bordo'],
    ['Linguista', 'ufficiale alle comunicazioni'],
    ['addetto ai segnali', 'ufficiale alle comunicazioni'],
  ])('maps the label or synonym %s to %s', (text, key) => {
    expect(archRoleKey(text)).toBe(key);
  });

  it('does not match «infermiere» or «infermiera»: the legacy pattern is /infermer/ (archfuturo.js:25), a defect tracked for WI-6', () => {
    expect(archRoleKey('Infermiere')).toBe('');
    expect(archRoleKey('Infermiera')).toBe('');
  });

  it.each(['cuoco', '', '   '])('gives an empty string for the unknown value %j', (text) => {
    expect(archRoleKey(text)).toBe('');
  });
});
