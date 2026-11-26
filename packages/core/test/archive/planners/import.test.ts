import { describe, expect, it } from 'vitest';
import { mapIncomingId } from '../../../src/archive/ids';
import { InvalidArchiveFileError } from '../../../src/archive/planners/errors';
import { planImport } from '../../../src/archive/planners/import';
import { EARLIER, NOW_ISO, makeCharacter, makeDeps, stored } from './fixtures';

const idOf = (legacy: string): string => mapIncomingId(legacy, () => 'unused').id;

/** A character as `archui.js:211` exports it: no revision, no versions. */
const incoming = (
  legacyId: string,
  changes: Record<string, unknown> = {},
): Record<string, unknown> => ({
  schema: 'personaggio/1',
  id: legacyId,
  version: 3,
  updated: '2026-11-25T10:00:00.000Z',
  name: legacyId.toUpperCase(),
  sex: 'f',
  age: 41,
  status: 'vivo',
  ...changes,
});

const archive = (chars: unknown[], changes: Record<string, unknown> = {}): unknown => ({
  schema: 'archivio/1',
  exported: '2026-11-25T11:00:00.000Z',
  chars,
  ...changes,
});

const stale = makeCharacter({
  id: idOf('c_a1'),
  version: 5,
  revision: 8,
  updated: '2026-11-20T00:00:00.000Z',
});

describe('planImport, what it accepts (FR-025, FR-046)', () => {
  it.each([
    ['a file of another schema', archive([], { schema: 'archivio/2' })],
    ['a file with no characters list', { schema: 'archivio/1', exported: 'x' }],
    ['a characters list that is not a list', archive([], { chars: {} })],
    ['a bare list', [incoming('c_a1')]],
    ['null', null],
    ['a character that is not an object', archive(['text'])],
    ['a character with a wrong field', archive([incoming('c_a1'), incoming('c_a2', { sex: 'x' })])],
    ['a character with a name that is not text', archive([incoming('c_a1', { name: 5 })])],
  ])('plans nothing and throws for %s', (_case, file) => {
    expect(() => planImport([], file, makeDeps())).toThrow(InvalidArchiveFileError);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('refuses a %s key at any depth', (key) => {
    const text = `{"schema":"archivio/1","chars":[{"name":"x","sections":{"${key}":{"a":1}}}]}`;
    expect(() => planImport([], JSON.parse(text), makeDeps())).toThrow(InvalidArchiveFileError);
  });

  it('accepts an empty archive and plans nothing', () => {
    expect(planImport([], archive([]), makeDeps())).toEqual([]);
  });
});

describe('planImport, new characters (archui.js:249)', () => {
  it('adds one as a first save with the incoming version, no reason and a mapped id', () => {
    const [write] = planImport([], archive([incoming('c_a1', { revision: 40 })]), makeDeps());
    expect(write).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: null,
      reason: null,
      character: {
        id: idOf('c_a1'),
        legacyId: 'c_a1',
        version: 3,
        revision: 1,
        updated: NOW_ISO,
        name: 'C_A1',
      },
    });
  });

  it('fills what a sparse file leaves out from the blank character', () => {
    const [write] = planImport([], archive([{ name: 'Zed' }]), makeDeps());
    expect(write).toMatchObject({
      character: {
        id: 'new-1',
        name: 'Zed',
        sex: 'm',
        age: 35,
        status: 'vivo',
        version: 1,
        sections: {},
      },
    });
  });

  it.each([[undefined], [''], [null]])('gives a character with the id %j a fresh id', (id) => {
    const [write] = planImport([], archive([incoming('c_a1', { id })]), makeDeps());
    expect(write).toMatchObject({ character: { id: 'new-1' } });
    expect(write).not.toHaveProperty('character.legacyId');
  });
});

describe('planImport, new characters, the rest', () => {
  it('keeps keys it does not know', () => {
    const [write] = planImport(
      [],
      archive([incoming('c_a1', { extra: { deep: [1] } })]),
      makeDeps(),
    );
    expect(write).toMatchObject({ character: { extra: { deep: [1] } } });
  });
});

describe('planImport, the id map (FR-017)', () => {
  it('maps every relation target with the same map as the ids', () => {
    const chars = [
      incoming('c_a1', { relations: [{ to: 'c_a2', type: 'amici', int: 1, view: '' }] }),
      incoming('c_a2'),
    ];
    const [first] = planImport([], archive(chars), makeDeps());
    expect(first).toMatchObject({ character: { relations: [{ to: idOf('c_a2') }] } });
  });
});

describe('planImport, uuids', () => {
  it('keeps ids that are already uuids, so an export of the web app imports without duplicates', () => {
    const uuid = '8f14e45f-ceea-467a-9575-4a1b1c9f0e11';
    const existing = makeCharacter({ id: uuid, updated: '2026-11-26T00:00:00.000Z' });
    expect(planImport([stored(existing)], archive([incoming(uuid)]), makeDeps())).toEqual([]);
  });
});

describe('planImport, the skip rule (archui.js:249)', () => {
  it.each([
    ['newer than', '2026-11-26T00:00:00.000Z'],
    ['as new as', '2026-11-25T10:00:00.000Z'],
  ])('skips a character when the stored one is %s the incoming', (_case, updated) => {
    const existing = makeCharacter({ id: idOf('c_a1'), updated });
    expect(planImport([stored(existing)], archive([incoming('c_a1')]), makeDeps())).toEqual([]);
  });
});

describe('planImport, replacing and repeating', () => {
  it('replaces a stored character that is older, as a versioned save with the reason «import archivio»', () => {
    const [write, ...rest] = planImport([stored(stale)], archive([incoming('c_a1')]), makeDeps());
    expect(rest).toEqual([]);
    expect(write).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: 8,
      reason: 'import archivio',
      character: { id: stale.id, version: 5, revision: 8, name: 'C_A1', updated: NOW_ISO },
    });
  });

  it('imports a character once when the file lists its id twice', () => {
    expect(planImport([], archive([incoming('c_a1'), incoming('c_a1')]), makeDeps())).toHaveLength(
      1,
    );
  });
});

describe('planImport, pending relations (archui.js:249)', () => {
  it('resolves them in place after the import and keeps the holder’s updated', () => {
    const holder = makeCharacter({
      revision: 2,
      pendingRelations: [{ name: 'c_a1', type: 'amici', int: 0, view: '' }],
    });
    const batch = planImport([stored(holder)], archive([incoming('c_a1')]), makeDeps());
    expect(batch).toHaveLength(2);
    expect(batch[1]).toMatchObject({
      kind: 'inPlaceUpdate',
      expectedRevision: 2,
      character: {
        id: holder.id,
        updated: EARLIER,
        relations: [{ to: idOf('c_a1') }],
        pendingRelations: [],
      },
    });
  });
});
