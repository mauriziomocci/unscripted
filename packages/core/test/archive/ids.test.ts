import { describe, expect, it } from 'vitest';
import { LEGACY_ID_NAMESPACE, mapIncomingId } from '../../src/archive/ids';

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
