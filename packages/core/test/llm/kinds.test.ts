import { describe, expect, it } from 'vitest';
import { LLM_CALL_KINDS } from '../../src/llm/kinds';

/**
 * The closed list of FR-011 and research.md R-23, copied from
 * `contracts/core-ports.d.ts:10-28`: the strings are persisted data (call
 * statistics in saved games and archives), so a rename is a migration.
 */
const EXPECTED_KINDS = [
  // island kinds, verbatim; 'god mode' keeps its space
  'mente',
  'regista',
  'animali',
  'mare',
  'biografia',
  'intervista',
  'analisi',
  'racconto',
  'episodio',
  'previsione',
  'mistero',
  'oggetto',
  'schizzo',
  'cerchio',
  'gruppo',
  'romanzo',
  'god mode',
  // talk show
  'talk-host',
  'talk-guest',
  'talk-listen',
  'talk-voice',
  'talk-twist',
  'talk-offair',
  'talk-review',
  'talk-story',
  'talk-recap',
  // settings test
  'probe',
  // Venture kinds not shared with the island
  'bibbia',
  'agende',
  'mondo',
  'ascolto',
  'battuta',
  'ordine',
  'comando',
  'esecuzione',
  'esterni',
  'diario',
  'sbarco',
  'report',
  // archive generator
  'archive-generate',
  // novel kinds not shared with the island
  'piano',
  'finale',
  'scena',
  'personaggi',
  'capitolo',
  'controllo',
  'lettore',
  'revisione',
  'serie',
  'eredita',
  'orienta',
  'verifica',
  'chiusura',
  'pignolo',
  'rilettura',
  'mirata',
  'registro',
  'stesura',
  'aiuto',
];

describe('LLM_CALL_KINDS', () => {
  it('lists the 59 kinds of FR-011 in order', () => {
    expect(LLM_CALL_KINDS).toEqual(EXPECTED_KINDS);
    expect(LLM_CALL_KINDS).toHaveLength(59);
  });

  it('has no duplicate', () => {
    expect(new Set(LLM_CALL_KINDS).size).toBe(LLM_CALL_KINDS.length);
  });

  it('keeps the space of god mode', () => {
    expect(LLM_CALL_KINDS).toContain('god mode');
  });
});
