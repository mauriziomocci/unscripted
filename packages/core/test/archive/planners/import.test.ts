import { describe, expect, it } from 'vitest';
import { mapIncomingId } from '../../../src/archive/ids';
import { InvalidArchiveFileError } from '../../../src/archive/planners/errors';
import { planImport } from '../../../src/archive/planners/import';
import { EARLIER, NOW_ISO, makeCharacter, makeDeps, stored } from './fixtures';

/** The batch of an import, without the count. */
const plan = (...args: Parameters<typeof planImport>) => planImport(...args).batch;

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
    expect(() => plan([], file, makeDeps())).toThrow(InvalidArchiveFileError);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('refuses a %s key at any depth', (key) => {
    const text = `{"schema":"archivio/1","chars":[{"name":"x","sections":{"${key}":{"a":1}}}]}`;
    expect(() => plan([], JSON.parse(text), makeDeps())).toThrow(InvalidArchiveFileError);
  });

  it('accepts an empty archive and plans nothing', () => {
    expect(plan([], archive([]), makeDeps())).toEqual([]);
  });
});

describe('planImport, new characters (archui.js:249)', () => {
  it('adds one as a first save with the incoming version, no reason and a mapped id', () => {
    const [write] = plan([], archive([incoming('c_a1', { revision: 40 })]), makeDeps());
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
    const [write] = plan([], archive([{ name: 'Zed' }]), makeDeps());
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
    const [write] = plan([], archive([incoming('c_a1', { id })]), makeDeps());
    expect(write).toMatchObject({ character: { id: 'new-1' } });
    expect(write).not.toHaveProperty('character.legacyId');
  });
});

describe('planImport, new characters, the rest', () => {
  it('keeps keys it does not know', () => {
    const [write] = plan([], archive([incoming('c_a1', { extra: { deep: [1] } })]), makeDeps());
    expect(write).toMatchObject({ character: { extra: { deep: [1] } } });
  });
});

describe('planImport, the id map (FR-017)', () => {
  it('maps every relation target with the same map as the ids', () => {
    const chars = [
      incoming('c_a1', { relations: [{ to: 'c_a2', type: 'amici', int: 1, view: '' }] }),
      incoming('c_a2'),
    ];
    const [first] = plan([], archive(chars), makeDeps());
    expect(first).toMatchObject({ character: { relations: [{ to: idOf('c_a2') }] } });
  });
});

describe('planImport, uuids', () => {
  it('keeps ids that are already uuids, so an export of the web app imports without duplicates', () => {
    const uuid = '8f14e45f-ceea-467a-9575-4a1b1c9f0e11';
    const existing = makeCharacter({ id: uuid, updated: '2026-11-26T00:00:00.000Z' });
    expect(plan([stored(existing)], archive([incoming(uuid)]), makeDeps())).toEqual([]);
  });
});

describe('planImport, the skip rule (archui.js:249)', () => {
  it.each([
    ['newer than', '2026-11-26T00:00:00.000Z'],
    ['as new as', '2026-11-25T10:00:00.000Z'],
  ])('skips a character when the stored one is %s the incoming', (_case, updated) => {
    const existing = makeCharacter({ id: idOf('c_a1'), updated });
    expect(plan([stored(existing)], archive([incoming('c_a1')]), makeDeps())).toEqual([]);
  });
});

describe('planImport, replacing and repeating', () => {
  it('replaces a stored character that is older, as a versioned save with the reason «import archivio»', () => {
    const [write, ...rest] = plan([stored(stale)], archive([incoming('c_a1')]), makeDeps());
    expect(rest).toEqual([]);
    expect(write).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: 8,
      reason: 'import archivio',
      character: { id: stale.id, version: 5, revision: 8, name: 'C_A1', updated: NOW_ISO },
    });
  });

  it('imports a character once when the file lists its id twice', () => {
    expect(plan([], archive([incoming('c_a1'), incoming('c_a1')]), makeDeps())).toHaveLength(1);
  });
});

describe('planImport, pending relations (archui.js:249)', () => {
  it('resolves them in place after the import and keeps the holder’s updated', () => {
    const holder = makeCharacter({
      revision: 2,
      pendingRelations: [{ name: 'c_a1', type: 'amici', int: 0, view: '' }],
    });
    const batch = plan([stored(holder)], archive([incoming('c_a1')]), makeDeps());
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

/** An inline history row as a raw dump of the legacy writes it (`archui.js:37`). */
const row = (v: unknown, changes: Record<string, unknown> = {}): Record<string, unknown> => ({
  v,
  at: `2026-11-1${String(v)}T10:00:00.000Z`,
  why: `motivo ${String(v)}`,
  data: incoming('c_a1', { version: v, name: `Versione ${String(v)}` }),
  ...changes,
});

/** The history a first save of `c_a1` at `version` carries after the import. */
function inlineVersionsOf(versions: unknown[], version = 5) {
  const [write] = plan([], archive([incoming('c_a1', { version, versions })]), makeDeps());
  return write?.kind === 'versionedSave' ? write.inlineVersions : undefined;
}

describe('planImport, inline versions of a new character (edge cases, data-model)', () => {
  it('turns them into history rows that keep the reason and the date, with the ids mapped', () => {
    const data = incoming('c_a1', {
      version: 1,
      relations: [{ to: 'c_a2', type: 'amici', int: 1, view: '' }],
    });
    const rows = inlineVersionsOf([row(1, { data }), row(2)]);
    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({
      version: 1,
      at: '2026-11-11T10:00:00.000Z',
      reason: 'motivo 1',
      data: { id: idOf('c_a1'), legacyId: 'c_a1', version: 1, relations: [{ to: idOf('c_a2') }] },
    });
    expect(rows?.[0]?.data).not.toHaveProperty('revision');
    expect(rows?.[0]?.data).not.toHaveProperty('versions');
  });

  it('keeps a missing date or reason as null', () => {
    const rows = inlineVersionsOf([{ v: 1, data: incoming('c_a1', { version: 1 }) }]);
    expect(rows).toMatchObject([{ version: 1, at: null, reason: null }]);
  });
});

describe('planImport, which inline versions are kept', () => {
  it.each([[0], [5], [6], [1.5], ['2'], [null], [undefined]])(
    'drops a row whose v is %j: not an integer in 1 to version - 1',
    (v) => {
      expect(inlineVersionsOf([row(1), row(v)])?.map((r) => r.version)).toEqual([1]);
    },
  );

  it('keeps one row per v, the last occurrence, in array order', () => {
    const rows = inlineVersionsOf([
      row(2, { why: 'prima' }),
      row(1),
      row(2, { why: 'ultima' }),
      row(3),
    ]);
    expect(rows?.map((r) => [r.version, r.reason])).toEqual([
      [1, 'motivo 1'],
      [2, 'ultima'],
      [3, 'motivo 3'],
    ]);
  });

  it('keeps the last 15 rows in array order', () => {
    const many = Array.from({ length: 20 }, (_, i) => row(i + 1, { at: null }));
    const rows = inlineVersionsOf(many, 25);
    expect(rows?.map((r) => r.version)).toEqual(Array.from({ length: 15 }, (_, i) => i + 6));
  });

  it('gives a first save with version 1 no rows', () => {
    expect(inlineVersionsOf([row(1)], 1)).toBeUndefined();
  });

  it.each([
    ['rows that are not a list', 'text'],
    ['a row that is not an object', ['text']],
    ['a row whose data is not a valid character', [{ v: 1, data: { name: 5 } }]],
  ])('refuses a file with %s', (_case, versions) => {
    const file = archive([incoming('c_a1', { versions })]);
    expect(() => plan([], file, makeDeps())).toThrow(InvalidArchiveFileError);
  });
});

describe('planImport, inline versions and deleted rows', () => {
  it('discards the inline versions of a character that replaces a stored one', () => {
    const file = archive([incoming('c_a1', { versions: [row(1)] })]);
    const [write] = plan([stored(stale)], file, makeDeps());
    expect(write).toMatchObject({ reason: 'import archivio' });
    expect(write).not.toHaveProperty('inlineVersions');
  });

  it('revives a deleted row as a versioned save with the reason «import archivio», keeping its id', () => {
    const archived = makeCharacter({ id: idOf('c_a1'), version: 4, revision: 6 });
    const file = archive([
      incoming('c_a1', { versions: [row(1)], updated: '2020-01-01T00:00:00.000Z' }),
    ]);
    const [write, ...rest] = plan([stored(archived, true)], file, makeDeps());
    expect(rest).toEqual([]);
    expect(write).toMatchObject({
      kind: 'versionedSave',
      expectedRevision: 6,
      reason: 'import archivio',
      character: { id: archived.id, version: 4, revision: 6, updated: NOW_ISO },
    });
    expect(write).not.toHaveProperty('inlineVersions');
  });
});

describe('planImport, the count for the note (archui.js:249-251)', () => {
  it('counts the characters it skipped, whatever the reason', () => {
    const existing = makeCharacter({ id: idOf('c_a1'), updated: '2026-11-26T00:00:00.000Z' });
    const file = archive([incoming('c_a1'), incoming('c_a2'), incoming('c_a2')]);
    expect(planImport([stored(existing)], file, makeDeps()).skipped).toBe(2);
  });

  it('counts none for a file whose characters are all new', () => {
    expect(planImport([], archive([incoming('c_a1'), incoming('c_a2')]), makeDeps()).skipped).toBe(
      0,
    );
  });
});

describe('planImport, one id twice in a file dated after the import', () => {
  it('writes the id once, from the last copy', () => {
    const future = '2027-01-01T00:00:00.000Z';
    const file = archive([
      incoming('c_a1', { name: 'Prima' }),
      incoming('c_a1', { name: 'Seconda', updated: future }),
    ]);
    const batch = plan([], file, makeDeps());
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ expectedRevision: null, character: { name: 'Seconda' } });
  });
});
