import { describe, expect, it } from 'vitest';
import { withPendingResolved } from '../../../src/archive/planners/pending';
import type { CharacterBatch } from '../../../src/store/characterStore';
import { EARLIER, NOW_ISO, makeCharacter, stored } from './fixtures';

const PENDING = { name: 'Bea Rossi', type: 'amici', int: 2, view: 'la stima' };
const holder = makeCharacter({ name: 'Ada', revision: 4, pendingRelations: [PENDING] });

/** A first save of a character, as the create planner writes it. */
const firstSave = (character: ReturnType<typeof makeCharacter>): CharacterBatch => [
  { kind: 'versionedSave', character, expectedRevision: null, reason: null },
];

describe('withPendingResolved (archui.js:85-88)', () => {
  it('leaves a relation pending while no character has that name', () => {
    const batch = firstSave(makeCharacter({ name: 'Carlo' }));
    expect(withPendingResolved([stored(holder)], batch, NOW_ISO)).toEqual(batch);
  });

  it('gives the holder the link as an in-place update when the character is created in the batch', () => {
    const bea = makeCharacter({ name: 'Bea Rossi' });
    const result = withPendingResolved([stored(holder)], firstSave(bea), NOW_ISO);
    expect(result).toEqual([
      ...firstSave(bea),
      {
        kind: 'inPlaceUpdate',
        expectedRevision: 4,
        character: {
          ...holder,
          updated: NOW_ISO,
          relations: [{ to: bea.id, type: 'amici', int: 2, view: 'la stima' }],
          pendingRelations: [],
        },
      },
    ]);
  });

  it('matches names with accents, case and spacing folded', () => {
    const bea = makeCharacter({ name: '  béa  ROSSI ' });
    const result = withPendingResolved([stored(holder)], firstSave(bea), NOW_ISO);
    expect(result).toHaveLength(2);
  });
});

describe('withPendingResolved, stamps and folding', () => {
  it('keeps the holder’s updated when no stamp is given (the import does not save, archui.js:249)', () => {
    const bea = makeCharacter({ name: 'Bea Rossi' });
    const [, update] = withPendingResolved([stored(holder)], firstSave(bea), null);
    expect(update).toMatchObject({ character: { updated: EARLIER } });
  });

  it('folds the resolution into the write of a character that is itself in the batch', () => {
    const bea = makeCharacter({ name: 'Bea Rossi' });
    const newcomer = makeCharacter({
      name: 'Dino',
      pendingRelations: [{ ...PENDING, name: 'Bea Rossi' }],
    });
    const batch: CharacterBatch = [
      { kind: 'versionedSave', character: newcomer, expectedRevision: null, reason: null },
    ];
    const [write, ...rest] = withPendingResolved([stored(bea)], batch, NOW_ISO);
    expect(rest).toEqual([]);
    expect(write).toMatchObject({
      kind: 'versionedSave',
      character: { relations: [{ to: bea.id, type: 'amici' }], pendingRelations: [] },
    });
  });
});

describe('withPendingResolved, edge cases', () => {
  it('does not add a link that exists already, and still drops the pending entry', () => {
    const bea = makeCharacter({ name: 'Bea Rossi' });
    const linked = makeCharacter({
      pendingRelations: [PENDING],
      relations: [{ to: bea.id, type: 'rivali', int: -1, view: '' }],
    });
    const [update] = withPendingResolved([stored(bea), stored(linked)], [], NOW_ISO);
    expect(update).toMatchObject({
      kind: 'inPlaceUpdate',
      character: { relations: [{ to: bea.id, type: 'rivali' }], pendingRelations: [] },
    });
  });
});

describe('withPendingResolved, self and targets', () => {
  it('drops a pending relation to the holder itself without linking it', () => {
    const self = makeCharacter({ name: 'Bea Rossi', pendingRelations: [PENDING] });
    const [update] = withPendingResolved([stored(self)], [], NOW_ISO);
    expect(update).toMatchObject({ character: { pendingRelations: [] } });
    expect(update).not.toHaveProperty('character.relations');
  });

  it('does not take an archived character for a target, nor one the batch deletes', () => {
    const archived = makeCharacter({ name: 'Bea Rossi' });
    const deleted = makeCharacter({ name: 'Bea Rossi', revision: 2 });
    const batch: CharacterBatch = [{ kind: 'softDelete', id: deleted.id, expectedRevision: 2 }];
    expect(
      withPendingResolved(
        [stored(holder), stored(archived, true), stored(deleted)],
        batch,
        NOW_ISO,
      ),
    ).toEqual(batch);
  });

  it('links to the first character with that name, in insertion order', () => {
    const first = makeCharacter({ name: 'Bea Rossi' });
    const second = makeCharacter({ name: 'Bea Rossi' });
    const [update] = withPendingResolved(
      [stored(holder), stored(first), stored(second)],
      [],
      NOW_ISO,
    );
    expect(update).toMatchObject({ character: { relations: [{ to: first.id }] } });
  });
});
