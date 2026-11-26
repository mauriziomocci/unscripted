/**
 * Every call kind the game may send to a language model.
 *
 * The list is closed because the strings are persisted data: saved games and
 * archives keep per-kind call counts, and a renamed kind would orphan them.
 * The island kinds are the legacy ones verbatim (`engine.js:26`, and
 * `engine.js:1492` for `god mode`, which keeps its space), the strings the
 * island's consumption panel counts (`ui.js:862`). The talk show, Venture,
 * archive generator and novel kinds are new names fixed by FR-011 at the
 * call sites that will use them (`talk.js`, `talkfun.js`, `venture.js`,
 * `archfuturo.js`, `romanzo.js`): those legacy loops pass no kind. A kind used by two
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
