import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/archive/character';
import {
  GENERATOR_TONE_KEYS,
  type GeneratorOptions,
  buildGeneratorPrompt,
  stylesForRole,
} from '../../src/archive/generate';
import { ROLE_PROMPT_NAMES } from '../../src/archive/roles';

const OPTIONS: GeneratorOptions = {
  role: 'capitano',
  sex: 'f',
  tone: 'serio',
  style: '',
  trait: '',
};

/** A character of the crew, with the fields the prompt reads. */
function member(name: string, changes: Partial<Character> = {}): Character {
  return {
    schema: 'personaggio/1',
    id: name,
    version: 1,
    revision: 1,
    updated: '2026-11-20T08:00:00.000Z',
    name,
    sex: 'm',
    age: 40,
    status: 'vivo',
    era: 'futuro',
    ...changes,
  };
}

/** The line of the prompt that starts with the label. */
function lineOf(prompt: string, label: string): string {
  return prompt.split('\n').find((line) => line.startsWith(label)) ?? '';
}

describe('buildGeneratorPrompt (archfuturo.js:70-108)', () => {
  it('names the role in lower case, in the request and in the format', () => {
    const prompt = buildGeneratorPrompt(OPTIONS, []);
    const name = (ROLE_PROMPT_NAMES.capitano ?? '').toLowerCase();
    expect(lineOf(prompt, 'RUOLO: ')).toBe(`RUOLO: ${name}`);
    expect(lineOf(prompt, 'Ruolo preferito: ')).toBe(`Ruolo preferito: ${name}`);
  });

  it('uses the raw role when it is not one of the eight', () => {
    expect(lineOf(buildGeneratorPrompt({ ...OPTIONS, role: 'Cuoco' }, []), 'RUOLO: ')).toBe(
      'RUOLO: Cuoco',
    );
  });

  it('leaves the style to the model when none is given, and uses it otherwise', () => {
    expect(lineOf(buildGeneratorPrompt(OPTIONS, []), 'STILE: ')).toBe(
      'STILE: scegli tu un tipo di ufficiale diverso da quelli già presenti',
    );
    const styled = buildGeneratorPrompt({ ...OPTIONS, style: 'il veterano disilluso' }, []);
    expect(lineOf(styled, 'STILE: ')).toBe('STILE: il veterano disilluso');
  });
});

describe('buildGeneratorPrompt conditionals and crew (archfuturo.js:70-108)', () => {
  it('adds the trait line only when there is a trait, before the sex line', () => {
    expect(buildGeneratorPrompt(OPTIONS, [])).not.toContain('TRATTO DA INCLUDERE');
    const prompt = buildGeneratorPrompt({ ...OPTIONS, trait: 'odia il teletrasporto' }, []);
    expect(prompt).toContain('TRATTO DA INCLUDERE: odia il teletrasporto\nSESSO: ');
  });

  it.each([
    ['f', 'donna'],
    ['m', 'uomo'],
    ['', 'scegli tu'],
  ] as const)('writes the sex %j as «%s»', (sex, word) => {
    expect(lineOf(buildGeneratorPrompt({ ...OPTIONS, sex }, []), 'SESSO: ')).toBe(`SESSO: ${word}`);
  });

  it.each([
    ['serio', 'serio e drammatico'],
    ['comico', 'comico: un disadattato simpatico, ma competente quando serve'],
  ] as const)('writes the tone %s', (tone, words) => {
    expect(lineOf(buildGeneratorPrompt({ ...OPTIONS, tone }, []), 'TONO: ')).toBe(`TONO: ${words}`);
  });
});

describe('buildGeneratorPrompt crew and placeholders (archfuturo.js:71)', () => {
  it('says «nessuno» for an empty crew', () => {
    expect(lineOf(buildGeneratorPrompt(OPTIONS, []), 'PERSONAGGI GIÀ A BORDO')).toMatch(
      /: nessuno$/,
    );
  });

  it('lists the living future characters with their role key or «senza ruolo»', () => {
    const crew = [
      member('Ada Verdi', { role: 'Pilota' }),
      member('Bruno Neri'),
      member('Carla Rossi', { status: 'deceduto', role: 'capitano' }),
      member('Dario Blu', { era: 'presente', role: 'capitano' }),
    ];
    expect(lineOf(buildGeneratorPrompt(OPTIONS, crew), 'PERSONAGGI GIÀ A BORDO')).toMatch(
      /: Ada Verdi \(timoniere\), Bruno Neri \(senza ruolo\)$/,
    );
  });

  it('does not let a name with a replacement pattern break the text', () => {
    const prompt = buildGeneratorPrompt(OPTIONS, [member('Zed $& {style}')]);
    expect(prompt).toContain('Zed $& {style} (senza ruolo)');
    expect(prompt).toContain('STILE: scegli tu');
  });

  it('keeps the JSON answer format, whose braces are not placeholders', () => {
    expect(buildGeneratorPrompt(OPTIONS, [])).toMatch(
      /Rispondi SOLO con JSON: \{"scheda": "<tutta la scheda in Markdown>"\}$/,
    );
  });
});

describe('stylesForRole (archfuturo.js:127)', () => {
  it('lists each style once, for the characters of that role only', () => {
    const crew = [
      member('A', { role: 'capitano', style: 'il burbero' }),
      member('B', { role: 'Comandante', style: 'il burbero' }),
      member('C', { role: 'capitano', style: 'la diplomatica' }),
      member('D', { role: 'capitano' }),
      member('E', { role: 'timoniere', style: 'il pilota' }),
    ];
    expect(stylesForRole(crew, 'capitano')).toEqual(['il burbero', 'la diplomatica']);
  });
});

describe('GENERATOR_TONE_KEYS', () => {
  it('has the two tones in the legacy order (archfuturo.js:69)', () => {
    expect(GENERATOR_TONE_KEYS).toEqual(['serio', 'comico']);
  });
});
