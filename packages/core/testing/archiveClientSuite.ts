import { describe, expect, it } from 'vitest';
import type { ArchiveClient } from '../src/archive/archiveClient';
import { blankCharacterInput } from '../src/archive/blank';
import type { Character, CharacterInput } from '../src/archive/character';
import { StaleWriteError } from '../src/store/errors';

/** Builds a fresh client over an empty store for one test; a real store truncates its tables here. */
export type ArchiveClientFactory = () => ArchiveClient | Promise<ArchiveClient>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LEGACY_ID = 'c_legacy1';

/** A sheet to send: the blank one, named. */
function sheet(name: string, changes: Partial<CharacterInput> = {}): CharacterInput {
  return { ...blankCharacterInput(), name, ...changes };
}

/** Creates a sheet with no reciprocal relations, so a test controls them. */
async function createPlain(
  client: ArchiveClient,
  name: string,
  changes: Partial<CharacterInput> = {},
) {
  const { character } = await client.create(sheet(name, changes), { symmetricRelations: false });
  return character;
}

/** A relation to another character, as the editor sends it. */
function relationTo(other: Character, type = 'amico') {
  return { to: other.id, type, int: 2, view: 'una buona persona' };
}

function describeCreateAndRead(factory: ArchiveClientFactory): void {
  it('creates a character at version 1 and reads it back', async () => {
    const client = await factory();
    const { character, warnings } = await client.create(sheet('Ada'), { symmetricRelations: true });
    expect(warnings).toEqual([]);
    expect(character).toMatchObject({ name: 'Ada', version: 1, revision: 1 });
    expect(character.id).toMatch(UUID);
    expect(await client.get(character.id)).toEqual(character);
    expect(await client.list()).toEqual([character]);
    expect(await client.versions(character.id)).toEqual([]);
  });

  it('answers null for an id it does not know', async () => {
    expect(await (await factory()).get('missing')).toBeNull();
  });

  it('keeps a deceased status through edit and export', async () => {
    const client = await factory();
    const created = await createPlain(client, 'Morto', { status: 'deceduto' });
    const { character } = await client.edit(
      created.id,
      sheet('Morto Rinominato', { status: 'deceduto' }),
      1,
    );
    expect(character.status).toBe('deceduto');
    const exported = (await client.exportArchive()).chars as readonly Record<string, unknown>[];
    expect(exported.map(({ name, status }) => [name, status])).toEqual([
      ['Morto Rinominato', 'deceduto'],
    ]);
  });
}

function describeEditing(factory: ArchiveClientFactory): void {
  it('edits with a new version, the manual reason and the old data in the history', async () => {
    const client = await factory();
    const created = await createPlain(client, 'Ada');
    const { character } = await client.edit(created.id, sheet('Ada Verdi'), created.revision);
    expect(character).toMatchObject({ name: 'Ada Verdi', version: 2, revision: 2 });
    const [row, ...others] = await client.versions(created.id);
    expect(others).toEqual([]);
    expect(row).toMatchObject({ version: 1, reason: 'modifica manuale' });
    expect(row?.data.name).toBe('Ada');
  });

  it('edits in place with no history row and the version kept', async () => {
    const client = await factory();
    const created = await createPlain(client, 'Ada');
    const { character } = await client.edit(created.id, sheet('Ada', { age: 50 }), 1, {
      mode: 'inPlace',
      symmetricRelations: false,
    });
    expect(character).toMatchObject({ age: 50, version: 1, revision: 2 });
    expect(await client.versions(created.id)).toEqual([]);
  });

  it('rejects an edit made on a stale revision and changes nothing', async () => {
    const client = await factory();
    const created = await createPlain(client, 'Ada');
    await client.edit(created.id, sheet('Ada Due'), 1);
    await expect(client.edit(created.id, sheet('Ada Tre'), 1)).rejects.toBeInstanceOf(
      StaleWriteError,
    );
    expect((await client.get(created.id))?.name).toBe('Ada Due');
  });

  it('keeps a disabled character listed and marked', async () => {
    const client = await factory();
    const created = await createPlain(client, 'Ada');
    await client.edit(created.id, sheet('Ada', { disabled: true }), 1);
    expect((await client.list()).map(({ name, disabled }) => [name, disabled])).toEqual([
      ['Ada', true],
    ]);
  });
}

function describeRelations(factory: ArchiveClientFactory): void {
  it('adds the reciprocal relation to the other character without a new version', async () => {
    const client = await factory();
    const ada = await createPlain(client, 'Ada');
    const bruno = await createPlain(client, 'Bruno');
    await client.edit(ada.id, sheet('Ada', { relations: [relationTo(bruno)] }), 1);
    const other = await client.get(bruno.id);
    expect(other?.relations).toEqual([{ to: ada.id, type: 'amico', int: 2, view: '' }]);
    expect(other?.version).toBe(1);
    expect(await client.versions(bruno.id)).toEqual([]);
  });

  it('returns a warning when the other side names the link differently', async () => {
    const client = await factory();
    const ada = await createPlain(client, 'Ada');
    const bruno = await createPlain(client, 'Bruno', { relations: [relationTo(ada, 'nemico')] });
    const { warnings } = await client.edit(
      ada.id,
      sheet('Ada', { relations: [relationTo(bruno)] }),
      1,
    );
    expect(warnings).toEqual([
      {
        code: 'relation_mismatch',
        characterId: ada.id,
        otherId: bruno.id,
        ownType: 'amico',
        otherType: 'nemico',
      },
    ]);
  });
}

function describeRestoreAndDelete(factory: ArchiveClientFactory): void {
  it('restores an earlier version as a new one, with its own reason', async () => {
    const client = await factory();
    const created = await createPlain(client, 'Ada');
    await client.edit(created.id, sheet('Ada Verdi'), 1);
    const restored = await client.restore(created.id, 1, 2);
    expect(restored).toMatchObject({ name: 'Ada', version: 3 });
    expect((await client.versions(created.id))[0]?.reason).toBe('ripristino v1');
  });

  it('deletes a character and removes the relations that pointed to it, leaving the others unversioned', async () => {
    const client = await factory();
    const ada = await createPlain(client, 'Ada');
    const bruno = await createPlain(client, 'Bruno');
    await client.edit(ada.id, sheet('Ada', { relations: [relationTo(bruno)] }), 1);
    const before = await client.versions(ada.id);
    await client.delete(bruno.id);
    expect(await client.get(bruno.id)).toBeNull();
    expect((await client.list()).map(({ id }) => id)).toEqual([ada.id]);
    expect((await client.get(ada.id))?.relations).toEqual([]);
    expect((await client.get(ada.id))?.version).toBe(2);
    expect(await client.versions(ada.id)).toEqual(before);
  });
}

function describeImportAndExport(factory: ArchiveClientFactory): void {
  it('exports every character and skips them all on a re-import, uuid ids included', async () => {
    const client = await factory();
    const ada = await createPlain(client, 'Ada');
    const bruno = await createPlain(client, 'Bruno', { relations: [relationTo(ada)] });
    const file = await client.exportArchive();
    expect(file.schema).toBe('archivio/1');
    expect(await client.importArchive(file)).toEqual({ imported: 0, skipped: 2 });
    expect((await client.list()).map(({ id }) => id)).toEqual([ada.id, bruno.id]);
  });

  it('maps a legacy id to a uuid, writes the legacy id back on export and does not duplicate it on re-import', async () => {
    const client = await factory();
    const file = {
      schema: 'archivio/1',
      exported: '2026-11-20T00:00:00.000Z',
      chars: [{ id: LEGACY_ID, name: 'Vecchio' }],
    };
    expect(await client.importArchive(file)).toEqual({ imported: 1, skipped: 0 });
    const [stored] = await client.list();
    expect(stored?.id).toMatch(UUID);
    expect(stored?.legacyId).toBe(LEGACY_ID);
    const exported = await client.exportArchive();
    expect((exported.chars[0] as Record<string, unknown>).id).toBe(LEGACY_ID);
    expect(await client.importArchive(exported)).toEqual({ imported: 0, skipped: 1 });
    expect(await client.list()).toHaveLength(1);
  });

  it('refuses an import that is not an archivio/1 file and writes nothing', async () => {
    const client = await factory();
    await expect(client.importArchive({ chars: [] })).rejects.toThrow();
    expect(await client.list()).toEqual([]);
  });
}

function describePack(factory: ArchiveClientFactory): void {
  it('adds the ready-made characters once, then none', async () => {
    const client = await factory();
    const { added } = await client.addPack();
    expect(added).toBeGreaterThan(0);
    expect(await client.list()).toHaveLength(added);
    expect(await client.addPack()).toEqual({ added: 0 });
  });

  it('revives a deleted ready-made character as a new version with the reason «pacchetto»', async () => {
    const client = await factory();
    await client.addPack();
    const [first] = await client.list();
    await client.delete(first?.id ?? '');
    expect(await client.addPack()).toEqual({ added: 1 });
    expect((await client.get(first?.id ?? ''))?.id).toBe(first?.id);
    expect((await client.versions(first?.id ?? ''))[0]?.reason).toBe('pacchetto');
  });
}

/**
 * The contract of an `ArchiveClient` (FR-050, FR-016, FR-022): what the UI
 * relies on, whatever it talks to. The same assertions run on `StoreArchive`
 * over each store, on `HttpStore` over the routes and on the artifact's
 * `LocalArchive`, which is what keeps the two forms equal (P-03b). The
 * factory returns a client over an empty archive each time it is called; the
 * ready-made pack is whatever the client carries, so its scenarios do not
 * name a count.
 */
export function describeArchiveClient(name: string, factory: ArchiveClientFactory): void {
  describe(`ArchiveClient: ${name}`, () => {
    describe('create and read', () => {
      describeCreateAndRead(factory);
    });
    describe('editing', () => {
      describeEditing(factory);
    });
    describe('relations', () => {
      describeRelations(factory);
    });
    describe('restore and delete', () => {
      describeRestoreAndDelete(factory);
    });
    describe('import and export', () => {
      describeImportAndExport(factory);
    });
    describe('ready-made pack', () => {
      describePack(factory);
    });
  });
}
