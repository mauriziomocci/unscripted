import type { Character } from '../character';
import type { StoredCharacter } from '../../store/characterStore';
import { CharacterNotFoundError } from './errors';

/** The stored, not deleted character with this id; throws `CharacterNotFoundError` for an unknown or archived one. */
export function findLive(current: readonly StoredCharacter[], id: string): Character {
  const found = current.find(({ character, archived }) => !archived && character.id === id);
  if (!found) throw new CharacterNotFoundError(id);
  return found.character;
}
