import type { CharacterInput } from './character';

/** The age of a blank character (`archui.js:34`), also what an empty age field becomes in the editor. */
export const DEFAULT_AGE = 35;

/**
 * The legacy blank character (`archBlank`, `archui.js:34`) without the keys the
 * store and the planners own (`id`, `version`, `revision`, `updated`): what a
 * sheet starts from, and what an imported record is completed with.
 */
export function blankCharacterInput(): CharacterInput {
  return {
    schema: 'personaggio/1',
    name: '',
    sex: 'm',
    age: DEFAULT_AGE,
    temper: '',
    short: '',
    tags: [],
    sections: {},
    secrets: [],
    goals: [],
    relations: [],
    status: 'vivo',
    life: 1,
    lives: [],
    origin: null,
    sessions: [],
  };
}
