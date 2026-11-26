import { describe, expect, it } from 'vitest';
import { characterTemplate } from '../../src/archive/markdown';
import { parseSheet } from './parseHelpers';

/** `archTemplate('presente')`, `archui.js:89-126`, as the legacy builds it. */
const PRESENT_TEMPLATE = `# Nome e cognome
Età: 40
Sesso: uomo
Temperamento: ironico
In breve: una riga che lo descrive (è quella che si vede sulla scheda)

## Identità e aspetto
_Chi è, che lavoro fa, com'è fatto, come si veste._

## Storia di vita
_Infanzia, famiglia, lavoro, gli eventi che l'hanno segnato._

## Carattere
_Pregi, difetti, come reagisce di solito._

## Valori, convinzioni, fissazioni
_In cosa crede, di cosa è convinto (anche se sbagliato), cosa non sopporta._

## Paure e punti deboli
_Cosa lo spaventa, dove è vulnerabile._

## Modo di parlare
_Lessico, intercalari, dialetto, tic verbali, tono._

## Come tratta gli altri
_Con chi gli dà ragione, con chi gli dà torto, con chi comanda._

## Segreti
- un segreto per riga (lo sa solo lui)

## Obiettivi
- cosa vuole ottenere, senza dirlo (uno per riga)

## Rapporti
- Nome di un altro personaggio: ex partner, -2, "cosa pensa di lui/lei"
`;

const AFTER_TEMPERAMENT = 'Temperamento: ironico\n';
const FUTURE_LINES = [
  'Epoca: futuro',
  'Ruolo preferito: capitano',
  'Stile: il tipo di ufficiale in poche parole',
];

/** The present template with lines added after the temperament line, which is all an era changes (`archui.js:92`). */
const withLines = (lines: readonly string[]): string =>
  PRESENT_TEMPLATE.replace(AFTER_TEMPERAMENT, `${AFTER_TEMPERAMENT}${lines.join('\n')}\n`);

describe('characterTemplate (archui.js:89-126, 210)', () => {
  it('writes the present-time template and its file name', () => {
    expect(characterTemplate('presente')).toEqual({
      fileName: 'modello-scheda-personaggio.md',
      text: PRESENT_TEMPLATE,
    });
  });

  it('adds Epoca, Ruolo preferito and Stile for the future and names the file after the crew', () => {
    expect(characterTemplate('futuro')).toEqual({
      fileName: 'modello-scheda-equipaggio.md',
      text: withLines(FUTURE_LINES),
    });
  });

  it('adds Epoca for the novel', () => {
    expect(characterTemplate('romanzo')).toEqual({
      fileName: 'modello-scheda-romanzo.md',
      text: withLines(['Epoca: romanzo']),
    });
  });

  it.each(['presente', 'futuro', 'romanzo'] as const)(
    'reads back as a sheet with every section, era %s',
    (era) => {
      const parsed = parseSheet(characterTemplate(era).text, 'modello.md');
      expect(parsed.input.name).toBe('Nome e cognome');
      expect(parsed.recognisedSections).toBe(10);
      expect(parsed.otherSections).toBe(0);
    },
  );
});
