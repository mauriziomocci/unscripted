/**
 * One step of a migration chain: takes a record at version `n` and returns it
 * at version `n + 1`, stamping the new `schema` string itself.
 */
export type MigrationStep = (record: unknown) => unknown;

/**
 * The migration chains of every stored record family. `character[i]` moves a
 * `personaggio/` record from version `i + 1` to `i + 2`, so the current
 * version of the family is the chain length plus one. In v1 the chain is
 * empty: nothing has been migrated yet.
 */
export const migrations: { readonly character: readonly MigrationStep[] } = {
  character: [],
};

/** A record carries no readable version of its family, or a version newer than this build knows. */
export class UnsupportedSchemaVersionError extends Error {
  /** The `schema` value found on the record, whatever it was. */
  readonly schema: unknown;

  constructor(schema: unknown) {
    const found = typeof schema === 'string' ? JSON.stringify(schema) : typeof schema;
    super(`unsupported record schema: ${found}`);
    this.name = 'UnsupportedSchemaVersionError';
    this.schema = schema;
  }
}

const CHARACTER_SCHEMA = /^personaggio\/([1-9]\d*)$/;

function schemaOf(record: unknown): unknown {
  return typeof record === 'object' && record !== null && 'schema' in record
    ? record.schema
    : undefined;
}

function characterVersionOf(record: unknown): number {
  const schema = schemaOf(record);
  const version = typeof schema === 'string' ? CHARACTER_SCHEMA.exec(schema)?.[1] : undefined;
  if (version === undefined) throw new UnsupportedSchemaVersionError(schema);
  return Number(version);
}

/**
 * Brings a stored character record to the current version by running the
 * steps that follow its own version, in order. A record that is already
 * current is returned as it is. A record from a newer build is refused rather
 * than read wrongly: opening a newer archive in an older build must fail
 * loudly. `chain` exists so the ordering is testable before a second version
 * exists; production calls use the default.
 */
export function migrateCharacter(
  record: unknown,
  chain: readonly MigrationStep[] = migrations.character,
): unknown {
  const version = characterVersionOf(record);
  if (version > chain.length + 1) throw new UnsupportedSchemaVersionError(schemaOf(record));
  return chain.slice(version - 1).reduce((current, apply) => apply(current), record);
}
