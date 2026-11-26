import { describe, expect, it } from 'vitest';
import {
  LEGACY_ID_NAMESPACE,
  mapIncomingId,
  mapReferenceId,
  withMappedIds,
} from '../../src/archive/ids';

/**
 * Vectors computed once with Python's `uuid.uuid5` (an implementation
 * independent of the `uuid` package under test) over the namespace below:
 * `uuid.uuid5(uuid.UUID('f0338bcd-...'), 'c_x1')`. A change of the namespace
 * or of the mapping changes every imported id, so these values are committed.
 */
const NAMESPACE = 'f0338bcd-0d4a-461e-9b1f-5c8a0414a6bc';
const V5_OF_C_X1 = '61f90bcf-539e-5fae-a21c-c0f0f7ea8561';
const V5_OF_F_X1 = '9c1ba2ef-85e2-5144-bf76-c1e8a70e683b';

const FRESH_ID = '11111111-2222-4333-8444-555555555555';
const newId = (): string => FRESH_ID;

describe('LEGACY_ID_NAMESPACE', () => {
  it('is the committed uuid', () => {
    expect(LEGACY_ID_NAMESPACE).toBe(NAMESPACE);
  });
});

describe('mapIncomingId with a legacy id', () => {
  it.each([
    ['c_x1', V5_OF_C_X1],
    ['f_x1', V5_OF_F_X1],
  ])('maps %s to its uuid v5 and keeps the legacy id', (legacy, expected) => {
    expect(mapIncomingId(legacy, newId)).toEqual({ id: expected, legacyId: legacy });
  });

  it('maps the same legacy id to the same uuid every time', () => {
    expect(mapIncomingId('c_x1', newId)).toEqual(mapIncomingId('c_x1', () => 'other'));
  });
});

describe('mapIncomingId with an id that needs no mapping', () => {
  it.each([V5_OF_C_X1, V5_OF_C_X1.toUpperCase(), FRESH_ID])('keeps the uuid %s as it is', (id) => {
    expect(mapIncomingId(id, newId)).toEqual({ id });
  });

  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
  ])('asks for a fresh id for %s', (_name, id) => {
    expect(mapIncomingId(id, newId)).toEqual({ id: FRESH_ID });
  });
});

describe('mapReferenceId', () => {
  it('maps a legacy id like mapIncomingId does, keeps a uuid and an empty value, and draws nothing', () => {
    expect(mapReferenceId('c_x1')).toBe(V5_OF_C_X1);
    expect(mapReferenceId(FRESH_ID)).toBe(FRESH_ID);
    expect(mapReferenceId('')).toBe('');
  });
});

describe('withMappedIds', () => {
  const bare = {
    schema: 'personaggio/1',
    id: 'c_x1',
    version: 1,
    revision: 1,
    updated: 'u',
    name: 'Ada',
    sex: 'f',
    age: 30,
    status: 'vivo',
  } as const;
  const legacy = { ...bare, relations: [{ to: 'f_x1', type: 'amici' }] };

  it('maps the id, keeps the legacy id and maps every relation target with the same map', () => {
    const mapped = withMappedIds(legacy, newId);
    expect(mapped).toMatchObject({ id: V5_OF_C_X1, legacyId: 'c_x1' });
    expect(mapped.relations).toEqual([{ to: V5_OF_F_X1, type: 'amici' }]);
  });

  it('keeps a legacy id the record already carries when its id is a uuid', () => {
    const uuid = { ...legacy, id: FRESH_ID, legacyId: 'c_old' };
    expect(withMappedIds(uuid, newId)).toMatchObject({ id: FRESH_ID, legacyId: 'c_old' });
  });

  it('adds no relations to a record that has none', () => {
    expect(withMappedIds(bare, newId)).not.toHaveProperty('relations');
  });
});
