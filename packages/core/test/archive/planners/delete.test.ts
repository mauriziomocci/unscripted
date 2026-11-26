import { describe, expect, it } from 'vitest';
import { CharacterNotFoundError } from '../../../src/archive/planners/errors';
import { deletionImpact, planDelete } from '../../../src/archive/planners/delete';
import { NOW_ISO, makeCharacter, makeDeps, snapshotOf, stored } from './fixtures';

const doomed = makeCharacter({ name: 'Ada', revision: 6 });
const link = (to: string, type = 'amici') => ({ to, type, int: 1, view: '' });

describe('planDelete (archui.js:294, FR-023)', () => {
  it('soft-deletes the character at its stored revision', () => {
    expect(planDelete([stored(doomed)], doomed.id, makeDeps())).toEqual([
      { kind: 'softDelete', id: doomed.id, expectedRevision: 6 },
    ]);
  });

  it('removes the relations that point to it from the others, in the same batch, in place, stamping updated (archui.js:38, 294)', () => {
    const fan = makeCharacter({
      revision: 3,
      relations: [link('someone'), link(doomed.id), link('x', 'rivali')],
    });
    const batch = planDelete([stored(doomed), stored(fan)], doomed.id, makeDeps());
    expect(batch).toEqual([
      { kind: 'softDelete', id: doomed.id, expectedRevision: 6 },
      {
        kind: 'inPlaceUpdate',
        expectedRevision: 3,
        character: { ...fan, relations: [link('someone'), link('x', 'rivali')], updated: NOW_ISO },
      },
    ]);
  });

  it('does not write characters that do not point to it, nor archived ones', () => {
    const stranger = makeCharacter({ relations: [link('someone')] });
    const hidden = makeCharacter({ relations: [link(doomed.id)] });
    const batch = planDelete(
      [stored(doomed), stored(stranger), stored(hidden, true)],
      doomed.id,
      makeDeps(),
    );
    expect(batch).toHaveLength(1);
  });

  it('refuses an unknown or already deleted character with a typed error', () => {
    expect(() => planDelete([], 'nope', makeDeps())).toThrow(CharacterNotFoundError);
    expect(() => planDelete([stored(doomed, true)], doomed.id, makeDeps())).toThrow(
      CharacterNotFoundError,
    );
  });
});

describe('deletionImpact (archui.js:295)', () => {
  it('counts the versions lost, the current one included, and the character’s own relations', () => {
    const character = makeCharacter({ relations: [link('a'), link('b')] });
    const history = [1, 2, 3].map((version) => ({
      version,
      at: null,
      reason: null,
      data: snapshotOf(character),
    }));
    expect(deletionImpact(character, history)).toEqual({ versions: 4, relations: 2 });
  });

  it('counts one version and no relations for a character that was never edited', () => {
    expect(deletionImpact(makeCharacter(), [])).toEqual({ versions: 1, relations: 0 });
  });
});
