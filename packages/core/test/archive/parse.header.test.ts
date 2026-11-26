import { describe, expect, it } from 'vitest';
import { parseCharacterFile } from '../../src/archive/parse';

/** Parses a sheet made only of the given lines. */
function parse(lines: readonly string[], fileName = 'scheda.md') {
  return parseCharacterFile(lines.join('\n'), fileName);
}

describe('parseCharacterFile header (archui.js:54-84)', () => {
  it('reads the name from the first heading and the key-value header lines', () => {
    const { character } = parse([
      '# Nome: Ada Verdi',
      'Età: 41',
      'Sesso: donna',
      'Temperamento: Ironico',
      'In breve: Una frase.',
    ]);
    expect(character).toMatchObject({
      name: 'Ada Verdi',
      age: 41,
      sex: 'f',
      temper: 'ironico',
      short: 'Una frase.',
    });
  });

  it('accepts the unaccented key «eta», «carattere in breve» for the short line, and any case', () => {
    const { character } = parse([
      '# Bruno',
      'ETA: 50',
      'sesso: Uomo',
      'Carattere in breve: Burbero.',
    ]);
    expect(character).toMatchObject({ age: 50, sex: 'm', short: 'Burbero.' });
  });

  it('takes the name from a «Nome:» line when no heading came first', () => {
    expect(parse(['Nome: Carla', 'Età: 30']).character.name).toBe('Carla');
  });

  it('falls back to the file name, without extension, dashes or underscores', () => {
    expect(parse(['Età: 30'], 'ada-verdi_nuova.md').character.name).toBe('ada verdi nuova');
    expect(parse([''], '').character.name).toBe('Senza nome');
  });

  it('keeps the default age when the value is not a number', () => {
    expect(parse(['# X', 'Età: boh']).character.age).toBe(35);
  });
});

describe('parseCharacterFile age and era', () => {
  it('clamps the age to 3-95, whatever the era (archui.js:70)', () => {
    expect(parse(['# X', 'Età: 1']).character.age).toBe(3);
    expect(parse(['# X', 'Età: 120']).character.age).toBe(95);
    expect(parse(['# X', 'Età: 120', 'Epoca: romanzo']).character.age).toBe(95);
  });

  it.each([
    ['futuro', 'futuro'],
    ['Futura', 'futuro'],
    ['romanzo', 'romanzo'],
    ['Romanzesca', 'romanzo'],
    ['presente', 'presente'],
    ['altro', 'presente'],
  ])('reads Epoca «%s» as %s', (value, era) => {
    expect(parse(['# X', `Epoca: ${value}`]).character.era).toBe(era);
  });

  it('leaves the era unset when the sheet has no Epoca line', () => {
    expect(parse(['# X']).character).not.toHaveProperty('era');
  });
});

describe('parseCharacterFile role, style and short', () => {
  it('stores «Ruolo preferito» and «Ruolo» as the role key, or the text cut to 40', () => {
    expect(parse(['# X', 'Ruolo preferito: Pilota']).character.role).toBe('timoniere');
    expect(parse(['# X', 'Ruolo: capitano']).character.role).toBe('capitano');
    const odd = 'cuoco '.repeat(10);
    expect(parse(['# X', `Ruolo: ${odd}`]).character.role).toBe(odd.trim().slice(0, 40));
  });

  it('caps «Stile» at 80 characters', () => {
    expect(parse(['# X', `Stile: ${'s'.repeat(100)}`]).character.style).toBe('s'.repeat(80));
  });

  it('reads header lines only before the first section', () => {
    const { character } = parse(['# X', '## Carattere', 'Età: 77', 'Sesso: donna']);
    expect(character).toMatchObject({ age: 35, sex: 'm' });
    expect(character.sections?.carattere).toBe('Età: 77\nSesso: donna');
  });

  it('derives «short» from the first sentence of carattere, then identita, then storia', () => {
    const body = (title: string) => ['# X', `## ${title}`, 'Prima frase. Seconda frase.'];
    expect(parse(body('Carattere')).character.short).toBe('Prima frase.');
    expect(parse(body('Identità e aspetto')).character.short).toBe('Prima frase.');
    expect(parse(body('Storia di vita')).character.short).toBe('Prima frase.');
    expect(parse(['# X']).character.short).toBe('');
  });

  it('cuts a derived «short» at 200 characters', () => {
    const { character } = parse(['# X', '## Carattere', 'a'.repeat(300)]);
    expect(character.short).toBe('a'.repeat(200));
  });
});

describe('parseCharacterFile section synonyms (archui.js:15-17)', () => {
  it.each([
    ['Identità e aspetto', 'identita'],
    ['Look', 'identita'],
    ['Storia di vita', 'storia'],
    ['Background', 'storia'],
    ['Carattere', 'carattere'],
    ['Personality', 'carattere'],
    ['Valori, convinzioni, fissazioni', 'valori'],
    ['Beliefs', 'valori'],
    ['Paure e punti deboli', 'paure'],
    ['Fears', 'paure'],
    ['Modo di parlare', 'parlata'],
    ['Speech', 'parlata'],
    ['Come tratta gli altri', 'relazioni_stile'],
    ['Others', 'relazioni_stile'],
    ['Qualcos altro ancora', 'altro'],
  ])('files the heading «%s» under %s', (title, key) => {
    const { character } = parse(['# X', `## ${title}`, 'testo']);
    expect(character.sections).toEqual({ [key]: 'testo' });
  });
});

describe('parseCharacterFile section content', () => {
  it('joins two sections with the same key with a blank line', () => {
    const { character } = parse(['# X', '## Storia', 'uno', '## Passato', 'due']);
    expect(character.sections?.storia).toBe('uno\n\ndue');
  });

  it('drops the italic placeholder lines of the template and empty sections', () => {
    const { character } = parse(['# X', '## Carattere', '_Pregi e difetti._', '## Storia', 'vera']);
    expect(character.sections).toEqual({ storia: 'vera' });
  });

  it('reads secrets and goals as lists, one item per bullet', () => {
    const { character } = parse([
      '# X',
      '## Segreti',
      '- primo segreto',
      '* secondo segreto',
      '1. terzo',
      '- ab',
      '## Obiettivi',
      '- vincere',
    ]);
    expect(character.secrets).toEqual(['primo segreto', 'secondo segreto', 'terzo']);
    expect(character.goals).toEqual(['vincere']);
  });

  it('reads «Rapporti» as pending relations by name', () => {
    const { character } = parse([
      '# X',
      '## Rapporti',
      '- Bea Rossi: amici, 2, "la stima molto"',
      '- Carlo: rivali, −3',
      '- Dino: colleghi',
    ]);
    expect(character.pendingRelations).toEqual([
      { name: 'Bea Rossi', type: 'amici', int: 2, view: 'la stima molto' },
      { name: 'Carlo', type: 'rivali', int: -3, view: '' },
      { name: 'Dino', type: 'colleghi', int: 0, view: '' },
    ]);
  });
});

describe('parseCharacterFile defaults', () => {
  it('has the blank-character defaults of the legacy and no store-owned key', () => {
    const { character } = parse(['# X']);
    expect(character).toMatchObject({
      schema: 'personaggio/1',
      sex: 'm',
      age: 35,
      temper: '',
      tags: [],
      sections: {},
      secrets: [],
      goals: [],
      relations: [],
      status: 'vivo',
      life: 1,
      lives: [],
      origin: null,
      sessions: [],
    });
    expect(character).not.toHaveProperty('id');
    expect(character).not.toHaveProperty('version');
    expect(character).not.toHaveProperty('revision');
  });
});
