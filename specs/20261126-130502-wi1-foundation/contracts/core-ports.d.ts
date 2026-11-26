// STATUS: DONE (approved provisionally, D-26-5)
//
// Sketch of the public surface of packages/core for WI-1 (umbrella spec section 2.2,
// FR-010, FR-011, FR-012, FR-013, FR-016, FR-050, FR-052). Design artifact, not code:
// the real declarations live in packages/core/src and carry TSDoc there.
// Pure core (A-03): no DOM, no Node types; time, randomness and fresh ids are injected.

// ---------- Call kinds (FR-011): 59 distinct strings, data persisted by both forms ----------

export declare const LLM_CALL_KINDS: readonly [
  // island ENGINE kinds, verbatim (engine.js:26, engine.js:1492 for 'god mode')
  'mente', 'regista', 'animali', 'mare', 'biografia', 'intervista', 'analisi', 'racconto', 'episodio',
  'previsione', 'mistero', 'oggetto', 'schizzo', 'cerchio', 'gruppo', 'romanzo', 'god mode',
  // talk show (talk.js:162, 209, 393, 679, 692, 710; talkfun.js:83, 129)
  'talk-host', 'talk-guest', 'talk-listen', 'talk-voice', 'talk-twist', 'talk-offair',
  'talk-review', 'talk-story', 'talk-recap',
  // settings test
  'probe',
  // Venture strings not already above (venture.js; intervista, racconto, romanzo are shared)
  'bibbia', 'agende', 'mondo', 'ascolto', 'battuta', 'ordine', 'comando', 'esecuzione', 'esterni',
  'diario', 'sbarco', 'report',
  // archive generator (archfuturo.js:109-116)
  'archive-generate',
  // novel (romanzo.js; romanzo is shared)
  'piano', 'finale', 'scena', 'personaggi', 'capitolo', 'controllo', 'lettore', 'revisione', 'serie',
  'eredita', 'orienta', 'verifica', 'chiusura', 'pignolo', 'rilettura', 'mirata', 'registro',
  'stesura', 'aiuto',
];
export type LlmCallKind = (typeof LLM_CALL_KINDS)[number];

// ---------- LLM port (P-01, P-01a, P-02) ----------

export type LlmTier = 'main' | 'light';
export type JsonSchema = Readonly<Record<string, unknown>>;

export interface LlmRequest {
  readonly kind: LlmCallKind;
  readonly tier: LlmTier;
  /** Meaningful only with tier 'main' (P-01a); never named 'quick'. */
  readonly lowLatency?: boolean;
  /** 0 on the first try, at most 5 (S-08, FR-028). Core alone counts attempts. */
  readonly attempt?: number;
  readonly prompt: string;
  readonly schema?: JsonSchema;
  readonly maxTokens?: number;
  readonly gameId?: string;
  readonly signal?: AbortSignal; // structural type declared in core, not the DOM one (A-03)
}

export interface LlmResult {
  /** The already-parsed JSON answer (P-01, C3). Validated by the caller with zod before use. */
  readonly value: unknown;
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number };
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResult>;
}

export type LlmErrorCode =
  | 'rate_limited' | 'timeout' | 'unparseable' | 'unavailable'
  | 'denied' | 'model_refused' | 'budget' | 'invalid_request';

export declare class LlmError extends Error {
  readonly code: LlmErrorCode;
  /** Only with 'rate_limited', when the transport gave a wait (S-08); never computed by a client. */
  readonly retryAfterMs?: number;
  constructor(code: LlmErrorCode, message: string, options?: { retryAfterMs?: number; cause?: unknown });
}

// ---------- Time, randomness, scheduling (P-05) ----------

export interface Clock {
  /** Wall time in ms since the epoch. */
  now(): number;
  /** Monotonic ms. */
  perfNow(): number;
}
export interface Scheduler {
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(callback: () => void, ms: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
}
export type TimerHandle = { readonly __timer: unique symbol };
export interface Rng {
  /** A number in [0, 1). */
  next(): number;
}
/** mulberry32, the algorithm of the legacy rngFrom (sim.js:5-11), shared with tools/golden (FR-012). */
export declare function createRng(seed: number): Rng;

// ---------- Optional capabilities (P-06) ----------

export interface Speech { speak(text: string, voice?: string): void; stop(): void; }
export interface Downloads { save(fileName: string, content: string, mimeType: string): void; }

// ---------- Character model (FR-013) and archive (P-03, P-03a, P-03b, FR-016, FR-017) ----------

/** Inferred from the zod CharacterSchema; see data-model.md for every key. Root is open (passthrough). */
export interface Character {
  readonly schema: 'personaggio/1';
  readonly id: string;
  readonly legacyId?: string;
  readonly version: number;
  readonly revision: number;
  readonly updated: string;
  readonly name: string;
  readonly sex: 'm' | 'f';
  readonly age: number;
  readonly status: 'vivo' | 'deceduto';
  readonly disabled?: boolean;
  readonly era?: string;
  readonly [unknownRootKey: string]: unknown;
}

/** Real declarations are inferred from zod (review N6): `Omit` over a type with a string index signature would
 *  erase every named key, so both types come from the schema, which keeps the named keys and the catch-all.
 *    export type CharacterInput    = z.infer<typeof CharacterInputSchema>;    // CharacterSchema.omit({ id, legacyId, version, revision })
 *    export type CharacterSnapshot = z.infer<typeof CharacterSnapshotSchema>; // CharacterSchema.omit({ revision })
 *  Planners strip id, legacyId, version and revision if a client sends them (D-26-4). */
export declare const CharacterSchema: unknown;          // zod looseObject at every level (data-model.md)
export declare const CharacterInputSchema: unknown;
export declare const CharacterSnapshotSchema: unknown;
/** Request-side JSON Schema (draft-07, io 'input') of the three records, computed once in core from private unguarded shapes; routes and documents use these, never a shape. */
export declare const CHARACTER_JSON_SCHEMA: JsonSchema;
export declare const CHARACTER_INPUT_JSON_SCHEMA: JsonSchema;
export declare const CHARACTER_SNAPSHOT_JSON_SCHEMA: JsonSchema;
export interface CharacterInput {
  readonly schema: 'personaggio/1';
  readonly updated?: string;   // set by the planners from the Clock on every save (archui.js:38)
  readonly name: string;
  readonly sex: 'm' | 'f';
  readonly age: number;
  readonly status: 'vivo' | 'deceduto';
  readonly disabled?: boolean;
  readonly era?: string;
  readonly [unknownRootKey: string]: unknown;
}
export interface CharacterSnapshot extends CharacterInput { readonly id: string; readonly legacyId?: string; readonly version: number; }

/** A notice a save produced (FR-016, FR-072): the legacy «⚠ Incoerenza» toast of archui.js:306. */
export interface ArchiveWarning {
  readonly code: 'relation_mismatch';
  readonly characterId: string;
  readonly otherId: string;
  readonly ownType: string;
  readonly otherType: string;
}
export interface WriteResult { readonly character: Character; readonly warnings: readonly ArchiveWarning[]; }

export interface CharacterVersion {
  readonly version: number;
  /** The superseded version's own `updated` (archui.js:37). */
  readonly at: string | null;
  /** Reason of the save that superseded it (archui.js:37); null when none was stored. */
  readonly reason: string | null;
  readonly data: CharacterSnapshot;
}

export type CharacterWrite =
  | { readonly kind: 'versionedSave'; readonly character: Character; readonly expectedRevision: number | null; readonly reason: string | null; readonly inlineVersions?: readonly CharacterVersion[] }
  | { readonly kind: 'inPlaceUpdate'; readonly character: Character; readonly expectedRevision: number }
  | { readonly kind: 'softDelete'; readonly id: string; readonly expectedRevision: number };
export type CharacterBatch = readonly CharacterWrite[];

/** Persistence only (P-03). One atomic write; any stale revision refuses the whole batch. */
export interface CharacterStore {
  /** Not soft-deleted by default; the planners ask for archived rows too (FR-017, FR-024).
   *  Order: insertion order (`seq`), the same on both stores and asserted by the FR-050 suite (review V1). */
  list(options?: { includeArchived?: false }): Promise<readonly Character[]>;
  list(options: { includeArchived: true }): Promise<readonly StoredCharacter[]>;
  get(id: string): Promise<Character | null>;
  versions(id: string): Promise<readonly CharacterVersion[]>;   // newest first, at most 15
  apply(batch: CharacterBatch): Promise<void>;
}
export interface StoredCharacter { readonly character: Character; readonly archived: boolean; }

export declare class StaleWriteError extends Error { readonly id: string; }
export declare class StoreUnavailableError extends Error {}

/** What the UI uses (P-03b). HttpStore implements it over the routes; StoreArchive over any CharacterStore.
 *  Disabling is not a separate operation: the «Disattivato» checkbox is part of the editor save (archui.js:271, 297);
 *  P-03b's «disable» is exercised through edit() in the FR-050 suite, with a parity note (review M9). */
export interface ArchiveClient {
  list(): Promise<readonly Character[]>;
  get(id: string): Promise<Character | null>;
  versions(id: string): Promise<readonly CharacterVersion[]>;
  create(input: CharacterInput, options?: { symmetricRelations?: boolean }): Promise<WriteResult>;
  /** id comes from the caller (the path, in HTTP); expectedRevision is the only concurrency input.
   *  versioned: editor normalisations, reason «modifica manuale», symmetric relations by default.
   *  inPlace: stored as sent, no normalisation, symmetricRelations must not be true. */
  edit(id: string, input: CharacterInput, expectedRevision: number, options?: { mode?: 'versioned' | 'inPlace'; symmetricRelations?: boolean }): Promise<WriteResult>;
  restore(id: string, version: number, expectedRevision: number): Promise<Character>;
  delete(id: string): Promise<void>;
  importArchive(file: unknown): Promise<{ imported: number; skipped: number }>;
  exportArchive(): Promise<ArchiveFileV1>;
  addPack(): Promise<{ added: number }>;
}
export interface ArchiveFileV1 { readonly schema: 'archivio/1'; readonly exported: string; readonly chars: readonly unknown[]; }

export interface ArchiveDeps { readonly clock: Clock; readonly newId: () => string; }
/** The single applier of the planners (R-18): server routes and LocalArchive both use it. */
export declare class StoreArchive implements ArchiveClient {
  constructor(store: CharacterStore, deps: ArchiveDeps);
  list(): Promise<readonly Character[]>;
  get(id: string): Promise<Character | null>;
  versions(id: string): Promise<readonly CharacterVersion[]>;
  create(input: CharacterInput, options?: { symmetricRelations?: boolean }): Promise<WriteResult>;
  /** id comes from the caller (the path, in HTTP); expectedRevision is the only concurrency input.
   *  versioned: editor normalisations, reason «modifica manuale», symmetric relations by default.
   *  inPlace: stored as sent, no normalisation, symmetricRelations must not be true. */
  edit(id: string, input: CharacterInput, expectedRevision: number, options?: { mode?: 'versioned' | 'inPlace'; symmetricRelations?: boolean }): Promise<WriteResult>;
  restore(id: string, version: number, expectedRevision: number): Promise<Character>;
  delete(id: string): Promise<void>;
  importArchive(file: unknown): Promise<{ imported: number; skipped: number }>;
  exportArchive(): Promise<ArchiveFileV1>;
  addPack(): Promise<{ added: number }>;
}

/** A batch plus the warnings the planner found while building it (only create and edit produce warnings). */
export interface PlannedBatch { readonly batch: CharacterBatch; readonly warnings: readonly ArchiveWarning[]; }
/** Pure planners (P-03a). Each returns one batch; no I/O. */
export interface ArchivePlanners {
  planCreate(current: readonly StoredCharacter[], input: CharacterInput, deps: ArchiveDeps, options: { symmetricRelations: boolean }): PlannedBatch;
  planEdit(current: readonly StoredCharacter[], id: string, input: CharacterInput, expectedRevision: number, deps: ArchiveDeps, options: { mode: 'versioned' | 'inPlace'; symmetricRelations: boolean }): PlannedBatch;
  planRestore(current: readonly StoredCharacter[], history: readonly CharacterVersion[], id: string, version: number, expectedRevision: number, deps: ArchiveDeps): CharacterBatch;
  /** Needs the clock: the in-place cleanups stamp `updated` as archSave does (archui.js:38, 294). */
  planDelete(current: readonly StoredCharacter[], id: string, deps: ArchiveDeps): CharacterBatch;
  planPack(current: readonly StoredCharacter[], packs: readonly (readonly Character[])[], deps: ArchiveDeps): CharacterBatch;
  /** `file` is `unknown`: the planner validates it (archivio/1, no prototype key, every character) and throws InvalidArchiveFileError; a bad file plans nothing. */
  planImport(current: readonly StoredCharacter[], file: unknown, deps: ArchiveDeps): { readonly batch: CharacterBatch; /** Characters skipped by the legacy rule (archui.js:249), for the import note: no caller re-parses the file. */ readonly skipped: number };
}

/** The «✨ Genera» archive generator (FR-072, research R-25). Rules in core; labels in the UI locales (review N9). */
export declare const ARCHIVE_ROLE_KEYS: readonly string[];                       // the 8 keys in legacy order, archfuturo.js:7-16
export declare const ROLE_PROMPT_NAMES: Readonly<Record<string, string>>;        // key -> ROLES[i][2], prompt content only
export declare const GENERATOR_TONE_KEYS: readonly ['serio', 'comico'];          // archfuturo.js:69; labels are i18n
export interface GeneratorOptions {                                               // exactly what archGenerate reads, archfuturo.js:144
  readonly role: string;
  readonly sex: 'm' | 'f' | '';
  readonly tone: 'serio' | 'comico';
  readonly style: string;                                                         // '' means «scegli tu…»
  readonly trait: string;                                                         // '' means no trait line
}
/** archGenPrompt (archfuturo.js:70-108): template asset + the legacy conditionals; crew -> «PERSONAGGI GIÀ A BORDO» (line 71). */
export declare function buildGeneratorPrompt(options: GeneratorOptions, crew: readonly Character[]): string;
/** archGenParse (archfuturo.js:119-124); the result is an editor preview, never saved. */
export declare function parseGeneratedCharacter(answer: unknown, role: string, clock: Clock): { character: CharacterInput } | { error: string };
/** One logical call: kind 'archive-generate', tier 'main', schedule archiveGenerate (3 retries, archfuturo.js:109-116). */
export declare function generateCharacter(llm: LlmClient, options: GeneratorOptions, crew: readonly Character[], deps: ArchiveDeps): Promise<{ character: CharacterInput } | { error: string }>;
/** Distinct styles already used for a role, listed by the dialog (archfuturo.js:127, 136). */
export declare function stylesForRole(crew: readonly Character[], role: string): readonly string[];

/** archParse and archToMarkdown ported (FR-014); Italian messages verbatim.
 *  The clock dates the origin label «importato da <file> · dd/mm» (archui.js:62). */
export declare function parseCharacterFile(text: string, fileName: string, clock: Clock): ParsedCharacterFile;
/** What reading a file gives (archui.js:54-84). `error`: a refusal, with the legacy message and nothing else (archui.js:82).
 *  `character`: an editor preview, a CharacterInput without id, version, revision or updated, with the counts of the note
 *  «N sezioni riconosciute, M finite in «Altro»» (archui.js:251). `archive`: a JSON file with a `chars` list (archui.js:58),
 *  returned untouched for planImport, which validates it. */
export type ParsedCharacterFile =
  | { readonly kind: 'error'; readonly error: string }
  | { readonly kind: 'character'; readonly input: CharacterInput; readonly recognisedSections: number; readonly otherSections: number }
  | { readonly kind: 'archive'; readonly file: unknown };
/** `nameOf` is the legacy archGet (archui.js:133): it names a relation target, and must resolve LIVE characters only; a relation it cannot name is left out. */
export declare function characterToMarkdown(character: CharacterInput, options: { withSecrets: boolean; nameOf: (id: string) => string | undefined }): string;
export declare const LEGACY_ID_NAMESPACE: string;
export declare function mapIncomingId(id: unknown, newId: () => string): { id: string; legacyId?: string };

// ---------- Games (P-04): types only in WI-1, implemented in WI-2 (FR-052) ----------

export interface GameEvent {
  readonly schema_version: number;
  readonly seq: number;
  readonly kind: string;
  readonly gameTime: number;
  readonly actor: string | null;
  readonly payload: unknown;
}
export type Environment = 'island' | 'talkshow' | 'venture' | 'novel';
export interface GameCommit { readonly gameId: string; readonly expectedSeq: number; readonly events: readonly GameEvent[]; readonly state: unknown; }
export interface GameStore {
  createGame(environment: Environment, setup: unknown): Promise<{ gameId: string }>;
  getGame(gameId: string): Promise<{ gameId: string; environment: Environment; lastSeq: number; state: unknown } | null>;
  commit(commit: GameCommit): Promise<void>; // throws StaleWriteError on a stale expectedSeq
  events(gameId: string, page: { afterSeq: number; limit: number }): Promise<readonly GameEvent[]>;
  reports(gameId: string): Promise<readonly unknown[]>;
  saveReport(gameId: string, kind: string, data: unknown): Promise<void>;
}
export type Store = CharacterStore & GameStore;

// ---------- Retries and budget (S-08, S-09) ----------

export type BackoffScheduleName = 'island' | 'talkshow' | 'venture' | 'archiveGenerate';
export interface BackoffSchedule {
  readonly baseMs: number;        // 15000 (engine.js:32)
  readonly factor: number;        // 2
  readonly maxRetries: number;    // island 5, talk show 5, Venture 4, archive generator 3
  readonly maxStep?: number;      // island 5 (240 s)
  readonly scope: 'perGame' | 'perCall';
  readonly maxInFlight?: number;  // island 2 (engine.js:13), Venture 2
}
export declare const BACKOFF_SCHEDULES: Readonly<Record<BackoffScheduleName, BackoffSchedule>>;
/** Whether a call that has made `attempt` retries so far (0 on its first failure) may retry again; RangeError on a negative or non-integer attempt. */
export declare function mayRetry(schedule: BackoffSchedule, attempt: number): boolean;
/** Wait in ms before the retry at `step` (1-based), held at `maxStep`; never "stop" (that is mayRetry's job); RangeError on a step below 1. */
export declare function backoffWaitMs(schedule: BackoffSchedule, step: number): number;

export interface BudgetGovernor {
  /** Pass-through by default (S-09), so goldens equal the legacy. */
  admit(tier: LlmTier, gameMinute: number): boolean;
}
export declare const passThroughGovernor: BudgetGovernor;

// ---------- Utilities (FR-012, FR-018) ----------

/** First balanced JSON value in a text; code fences and trailing prose tolerated. */
export declare function extractJson(text: string): { ok: true; value: unknown } | { ok: false };
export declare function toJsonSchema(schema: unknown /* a zod schema */): JsonSchema;
export declare const migrations: { readonly character: readonly ((record: unknown) => unknown)[] };
