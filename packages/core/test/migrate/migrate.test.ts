import { describe, expect, it } from 'vitest';
import {
  migrateCharacter,
  migrations,
  UnsupportedSchemaVersionError,
  type MigrationStep,
} from '../../src/migrate/index';

/** A step that moves a record one version up and leaves a trail of what ran. */
function step(to: number, label: string): MigrationStep {
  return (record) => {
    const { trail, ...rest } = record as { trail?: string[] };
    return { ...rest, schema: `personaggio/${String(to)}`, trail: [...(trail ?? []), label] };
  };
}

const TWO_STEPS = [step(2, 'to-2'), step(3, 'to-3')];

describe('migrations.character in version 1', () => {
  it('is empty, so the current version is the first', () => {
    expect(migrations.character).toEqual([]);
  });

  it('returns a version 1 record unchanged', () => {
    const record = { schema: 'personaggio/1', name: 'Ada', extra: { kept: true } };
    expect(migrateCharacter(record)).toBe(record);
  });
});

describe('migrateCharacter with a chain', () => {
  it('applies every step from the record version, in order', () => {
    const record = { schema: 'personaggio/1', name: 'Ada' };
    expect(migrateCharacter(record, TWO_STEPS)).toEqual({
      schema: 'personaggio/3',
      name: 'Ada',
      trail: ['to-2', 'to-3'],
    });
  });

  it('starts at the step that follows the record version', () => {
    const migrated = migrateCharacter({ schema: 'personaggio/2' }, TWO_STEPS);
    expect(migrated).toEqual({ schema: 'personaggio/3', trail: ['to-3'] });
  });

  it('leaves a record that is already current alone', () => {
    const record = { schema: 'personaggio/3' };
    expect(migrateCharacter(record, TWO_STEPS)).toBe(record);
  });
});

describe('migrateCharacter on records it cannot read', () => {
  it('refuses a version newer than the chain knows, with a typed error', () => {
    const attempt = (): unknown => migrateCharacter({ schema: 'personaggio/2' });
    expect(attempt).toThrow(UnsupportedSchemaVersionError);
    expect(attempt).toThrow(expect.objectContaining({ schema: 'personaggio/2' }));
  });

  it.each([
    null,
    'personaggio/1',
    {},
    { schema: 1 },
    { schema: 'archivio/1' },
    { schema: 'personaggio/0' },
    { schema: 'personaggio/x' },
  ])('refuses %j, which carries no personaggio version', (record) => {
    expect(() => migrateCharacter(record)).toThrow(UnsupportedSchemaVersionError);
  });
});
