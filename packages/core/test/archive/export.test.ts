import { describe, expect, it } from 'vitest';
import { mapIncomingId } from '../../src/archive/ids';
import { toArchiveFile } from '../../src/archive/export';
import { planImport } from '../../src/archive/planners/import';
import { NOW_ISO, NOW_MS, makeCharacter, makeDeps, stored } from './planners/fixtures';

/** The batch of an import, without the count. */
const plan = (...args: Parameters<typeof planImport>) => planImport(...args).batch;

const clock = { now: () => NOW_MS, perfNow: () => 0 };

describe('toArchiveFile (archui.js:211, FR-026)', () => {
  it('writes the schema tag, the export time and the characters in listing order', () => {
    const first = makeCharacter({ name: 'Prima' });
    const second = makeCharacter({ name: 'Seconda' });
    const file = toArchiveFile([stored(first), stored(second)], clock);
    expect(file).toMatchObject({ schema: 'archivio/1', exported: NOW_ISO });
    expect(file.chars.map((c) => (c as { name: string }).name)).toEqual(['Prima', 'Seconda']);
  });

  it('leaves out deleted characters, versions and the store-owned revision', () => {
    const live = makeCharacter({ revision: 9, versions: [{ v: 1 }] });
    const file = toArchiveFile([stored(live), stored(makeCharacter(), true)], clock);
    expect(file.chars).toHaveLength(1);
    expect(file.chars[0]).not.toHaveProperty('revision');
    expect(file.chars[0]).not.toHaveProperty('versions');
  });

  it('writes the legacy id where there is one, for the id and for every relation target', () => {
    const uuid = '8f14e45f-ceea-467a-9575-4a1b1c9f0e11';
    const legacy = makeCharacter({
      id: mapIncomingId('c_a1', () => '').id,
      legacyId: 'c_a1',
      relations: [{ to: uuid, type: 'amici', int: 1, view: '' }],
    });
    const modern = makeCharacter({
      id: uuid,
      relations: [{ to: legacy.id, type: 'amici', int: 1, view: '' }],
    });
    const [a, b] = toArchiveFile([stored(legacy), stored(modern)], clock).chars;
    expect(a).toMatchObject({ id: 'c_a1', relations: [{ to: uuid }] });
    expect(a).not.toHaveProperty('legacyId');
    expect(b).toMatchObject({ id: uuid, relations: [{ to: 'c_a1' }] });
  });

  it('keeps unknown keys and the updated string as stored', () => {
    const file = toArchiveFile([stored(makeCharacter({ extra: { deep: 1 } }))], clock);
    expect(file.chars[0]).toMatchObject({
      extra: { deep: 1 },
      updated: '2026-11-20T08:00:00.000Z',
    });
  });
});

describe('toArchiveFile, the round trip with the import', () => {
  it('imports back, into an empty archive, as the same characters with the same ids', () => {
    const a = makeCharacter({
      id: mapIncomingId('c_a1', () => '').id,
      legacyId: 'c_a1',
      name: 'Ada',
    });
    const b = makeCharacter({
      id: '8f14e45f-ceea-467a-9575-4a1b1c9f0e11',
      name: 'Bea',
      relations: [{ to: a.id, type: 'amici', int: 2, view: 'x' }],
    });
    const file = toArchiveFile([stored(a), stored(b)], clock);
    const batch = plan([], file, makeDeps());
    const back = batch.flatMap((write) => (write.kind === 'softDelete' ? [] : [write.character]));
    expect(back.map((c) => c.id)).toEqual([a.id, b.id]);
    expect(back[0]).toMatchObject({ legacyId: 'c_a1' });
    expect(back[1]).toMatchObject({ relations: [{ to: a.id, type: 'amici', int: 2, view: 'x' }] });
  });
});
