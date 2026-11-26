import { z } from 'zod';
import { hasPrototypeKey } from './prototypeKeys';

/** The eight free-text sections of a character sheet, in the legacy order; every one is optional and uncapped. */
const SectionsSchema = z.looseObject({
  identita: z.string().optional(),
  storia: z.string().optional(),
  carattere: z.string().optional(),
  valori: z.string().optional(),
  paure: z.string().optional(),
  parlata: z.string().optional(),
  relazioni_stile: z.string().optional(),
  altro: z.string().optional(),
});

/** A link to another character. `int` and `view` are optional because the legacy reads them with a default (`archui.js:132`). */
const RelationSchema = z.looseObject({
  to: z.string(),
  type: z.string(),
  int: z.number().optional(),
  view: z.string().optional(),
});

/** A relation written by name in an imported file, resolved when the target appears (`archui.js:85-88`). */
const PendingRelationSchema = z.looseObject({
  name: z.string(),
  type: z.string(),
  int: z.number().optional(),
  view: z.string().optional(),
});

const OriginSchema = z.looseObject({ env: z.string().optional() });

const NovelMemoSchema = z.looseObject({ title: z.string().optional() });

const VentureSchema = z.looseObject({
  missions: z.unknown().optional(),
  log: z.unknown().optional(),
  medals: z.unknown().optional(),
});

/**
 * The record every other shape derives from. Open at every object level: a
 * key this build does not know is kept, so a character written by a newer
 * build or by the legacy game survives a round trip (FR-013). Only the nine
 * keys every record carries are required; the others are checked when present
 * and never invented, so a record round-trips exactly as stored.
 */
export const CharacterShape = z.looseObject({
  schema: z.literal('personaggio/1'),
  id: z.string(),
  legacyId: z.string().optional(),
  version: z.int().min(1),
  revision: z.int().min(1),
  /** ISO string as the legacy wrote it; compared as a string (`archui.js:249`). */
  updated: z.string(),
  name: z.string(),
  sex: z.enum(['m', 'f']),
  /** Any integer: the clamps belong to the parser and the editor, not to the record (`engine.js:1347`). */
  age: z.int(),
  temper: z.string().optional(),
  short: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sections: SectionsSchema.optional(),
  secrets: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  relations: z.array(RelationSchema).optional(),
  pendingRelations: z.array(PendingRelationSchema).optional(),
  status: z.enum(['vivo', 'deceduto']),
  disabled: z.boolean().optional(),
  life: z.int().optional(),
  lives: z.array(z.looseObject({})).optional(),
  deaths: z.union([z.number(), z.array(z.unknown())]).optional(),
  origin: OriginSchema.nullable().optional(),
  sessions: z.array(z.unknown()).optional(),
  summary: z.string().optional(),
  /** `'futuro'`, `'romanzo'`, or anything else, which reads as present time (`archfuturo.js:29`); no enum (AM-07). */
  era: z.string().optional(),
  role: z.string().optional(),
  style: z.string().optional(),
  venture: VentureSchema.optional(),
  novels: z.array(NovelMemoSchema).optional(),
});

/**
 * Puts the prototype-key check in front of a schema. It must look at the raw
 * input: zod's output never carries an own `__proto__` key (copying it would
 * set the prototype), so a check on the parsed value would pass a poisoned
 * document. A failure stops the pipe, so zod never parses it. Applied last,
 * because a pipe has no `.omit()` to derive further schemas from.
 */
function refusingPrototypeKeys<T extends z.ZodType>(schema: T): z.ZodPipe<z.ZodCustom, T> {
  return z
    .custom((value) => !hasPrototypeKey(value), {
      message: 'a prototype key (__proto__, constructor, prototype) is not allowed',
    })
    .pipe(schema);
}

/** What a client sends to create or edit a character: no store-owned key, `updated` optional (the planners set it from the Clock, `archui.js:38`). */
export const CharacterInputShape = CharacterShape.omit({
  id: true,
  legacyId: true,
  version: true,
  revision: true,
}).extend({ updated: z.string().optional() });

/** A superseded version as kept in the history: the character without its `revision`. */
export const CharacterSnapshotShape = CharacterShape.omit({ revision: true });

/*
 * The guarded schemas below parse; the shapes above derive. A pipe with a
 * custom check cannot be turned into JSON Schema on the request side, so route
 * and document schemas are derived from the shapes (`z.toJSONSchema(shape, {
 * io: 'input' })`), never from the guarded schemas.
 */

/** A stored character: what a store returns and what the planners build. */
export const CharacterSchema = refusingPrototypeKeys(CharacterShape);
export type Character = z.infer<typeof CharacterSchema>;

export const CharacterInputSchema = refusingPrototypeKeys(CharacterInputShape);
export type CharacterInput = z.infer<typeof CharacterInputSchema>;

export const CharacterSnapshotSchema = refusingPrototypeKeys(CharacterSnapshotShape);
export type CharacterSnapshot = z.infer<typeof CharacterSnapshotSchema>;
