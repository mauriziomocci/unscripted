/**
 * The public surface of `@unscripted/core` (FR-010): the values and types the
 * contract `core-ports.d.ts` declares, and nothing else. Core is pure: it owns
 * no clock, no randomness, no network and no storage, so every effect arrives
 * through the ports exported here (`LlmClient`, `CharacterStore`, `Clock`,
 * `Scheduler`).
 */
export type { ArchiveClient } from './archive/archiveClient';
export type { ArchiveFileV1 } from './archive/archiveFile';
export {
  CHARACTER_INPUT_JSON_SCHEMA,
  CHARACTER_JSON_SCHEMA,
  CHARACTER_SNAPSHOT_JSON_SCHEMA,
  CharacterInputSchema,
  CharacterSchema,
  CharacterSnapshotSchema,
  type Character,
  type CharacterInput,
  type CharacterSnapshot,
} from './archive/character';
export type { ArchiveDeps } from './archive/deps';
export {
  GENERATOR_TONE_KEYS,
  buildGeneratorPrompt,
  generateCharacter,
  parseGeneratedCharacter,
  stylesForRole,
  type GeneratorDeps,
  type GeneratorOptions,
} from './archive/generate';
export { LEGACY_ID_NAMESPACE, mapIncomingId } from './archive/ids';
export { characterToMarkdown } from './archive/markdown';
export { NormaliseError } from './archive/normalise';
export { parseCharacterFile, type ParsedCharacterFile } from './archive/parse';
export {
  ArchiveRequestError,
  CharacterNotFoundError,
  InvalidArchiveFileError,
  VersionNotFoundError,
} from './archive/planners/errors';
export { ARCHIVE_ROLE_KEYS, ROLE_PROMPT_NAMES } from './archive/roles';
export { StoreArchive, type StoreArchiveDeps } from './archive/storeArchive';
export { PRESENT_PACK } from './content/presentPack';
export { GameEventSchema, type GameEvent } from './events/gameEvent';
export { extractJson } from './json/extract';
export { BACKOFF_SCHEDULES, backoffWaitMs, mayRetry } from './llm/backoff';
export type { BackoffSchedule, BackoffScheduleName } from './llm/backoff';
export { passThroughGovernor, type BudgetGovernor } from './llm/budget';
export { LlmError, type LlmErrorCode } from './llm/errors';
export { LLM_CALL_KINDS, type LlmCallKind } from './llm/kinds';
export type { JsonSchema, LlmClient, LlmRequest, LlmResult, LlmTier } from './llm/request';
export { withSharedQueue } from './llm/sharedQueue';
export { UnsupportedSchemaVersionError, migrateCharacter, migrations } from './migrate/index';
export { createRng, type Rng } from './random/rng';
export { toJsonSchema } from './schema/toJsonSchema';
export { StaleWriteError, StoreUnavailableError } from './store/errors';
export type {
  ArchiveWarning,
  CharacterBatch,
  CharacterStore,
  CharacterVersion,
  CharacterWrite,
  StoredCharacter,
  WriteResult,
} from './store/characterStore';
export type { Clock, Scheduler, TimerHandle } from './time/ports';
