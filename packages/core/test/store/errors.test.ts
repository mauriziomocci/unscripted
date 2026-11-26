import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Character, CharacterSnapshot } from '../../src/archive/character';
import type { CharacterBatch, CharacterWrite } from '../../src/store/characterStore';
import { StaleWriteError, StoreUnavailableError } from '../../src/store/errors';

describe('StaleWriteError', () => {
  it('is an Error that names the record that moved', () => {
    const error = new StaleWriteError('c-1');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StaleWriteError);
    expect(error.name).toBe('StaleWriteError');
    expect(error.id).toBe('c-1');
    expect(error.message).toContain('c-1');
  });
});

describe('StoreUnavailableError', () => {
  it('is an Error, told apart from a stale write by its type', () => {
    const error = new StoreUnavailableError('database unreachable');
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(StaleWriteError);
    expect(error.name).toBe('StoreUnavailableError');
    expect(error.message).toBe('database unreachable');
  });

  it('keeps the cause it wraps', () => {
    const cause = new Error('ECONNREFUSED');
    expect(new StoreUnavailableError('down', { cause }).cause).toBe(cause);
  });
});

describe('CharacterWrite', () => {
  const character = {} as Character;
  const snapshot = {} as CharacterSnapshot;

  it('accepts the three shapes of the batch (type test, checked by tsc)', () => {
    const versionedSave = {
      kind: 'versionedSave',
      character,
      expectedRevision: null,
      reason: 'modifica manuale',
      inlineVersions: [{ version: 1, at: null, reason: null, data: snapshot }],
    } satisfies CharacterWrite;
    const inPlaceUpdate = {
      kind: 'inPlaceUpdate',
      character,
      expectedRevision: 3,
    } satisfies CharacterWrite;
    const softDelete = {
      kind: 'softDelete',
      id: 'c-1',
      expectedRevision: 3,
    } satisfies CharacterWrite;
    const batch: CharacterBatch = [versionedSave, inPlaceUpdate, softDelete];
    expect(batch.map((write) => write.kind)).toEqual([
      'versionedSave',
      'inPlaceUpdate',
      'softDelete',
    ]);
  });

  it('is exactly the three kinds', () => {
    expectTypeOf<CharacterWrite['kind']>().toEqualTypeOf<
      'versionedSave' | 'inPlaceUpdate' | 'softDelete'
    >();
  });
});
