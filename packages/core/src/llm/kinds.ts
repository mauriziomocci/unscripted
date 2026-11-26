/**
 * Every call kind the game may send to a language model.
 *
 * The list is closed because the strings are persisted data: saved games and
 * archives keep per-kind call counts, and a renamed kind would orphan them.
 * The island, Venture and novel kinds are legacy literals passed verbatim to
 * the legacy `ask` functions (`engine.js:26`, and `engine.js:1492` for
 * `god mode`, which keeps its space; `venture.js` through `llm.js:39`;
 * `romanzo.js`). Only the talk show kinds and `archive-generate` are new
 * names fixed by FR-011, because the legacy talk show (`tsAsk`, `talk.js:79`)
 * and archive generator (`archGenCall`, `archfuturo.js:109`) pass none. A kind used by two
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
