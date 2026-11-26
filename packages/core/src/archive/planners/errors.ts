/** The character a request names is not in the archive, or is deleted. */
export class CharacterNotFoundError extends Error {
  readonly id: string;

  constructor(id: string, options?: ErrorOptions) {
    super(`character not found: ${id}`, options);
    this.name = 'CharacterNotFoundError';
    this.id = id;
  }
}

/** The character has no such version in its history. */
export class VersionNotFoundError extends Error {
  readonly id: string;
  readonly version: number;

  constructor(id: string, version: number, options?: ErrorOptions) {
    super(`version ${String(version)} of ${id} not found`, options);
    this.name = 'VersionNotFoundError';
    this.id = id;
    this.version = version;
  }
}

/** A request the planners refuse before building any batch; callers decide by `code`. */
export class ArchiveRequestError extends Error {
  readonly code: 'id_mismatch' | 'symmetric_in_place';

  constructor(code: 'id_mismatch' | 'symmetric_in_place', message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ArchiveRequestError';
    this.code = code;
  }
}

/** The file offered to an import is not an `archivio/1` archive of valid characters; nothing was planned. */
export class InvalidArchiveFileError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidArchiveFileError';
  }
}
