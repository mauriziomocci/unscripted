/**
 * Every call kind the game may send to a language model.
 *
 * The list is closed because the strings are persisted data: saved games and
 * archives keep per-kind call counts, and a renamed kind would orphan them.
 * The island kinds are the legacy ones verbatim (`engine.js:26`, and
 * `engine.js:1492` for `god mode`, which keeps its space); the other groups
 * are the strings the other environments pass to the same `ask` function
 * (`ui.js:862` lists them in the consumption panel). A kind used by two
 * environments (`intervista`, `racconto`, `romanzo`) appears once.
 */
export const LLM_CALL_KINDS = [
  // island
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
  // Venture, the kinds not already listed above
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
  // novel, the kinds not already listed above
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
] as const;

/** One of the closed list of call kinds. */
export type LlmCallKind = (typeof LLM_CALL_KINDS)[number];
