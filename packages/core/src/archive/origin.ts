import type { Clock } from '../time/ports';

/** Where a character came from, as the card and the editor show it (`archui.js:240, 265`). */
export type CharacterOrigin = { label: string };

/** The day and month the legacy prints in its origin labels (`today()`, `archui.js:20`): `27/11`. */
function today(clock: Clock): string {
  return new Date(clock.now()).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

/** The origin of a sheet read from a file (`archui.js:62`). */
export function importedOrigin(fileName: string, clock: Clock): CharacterOrigin {
  return { label: `importato da ${fileName || 'file'} · ${today(clock)}` };
}

/** The origin of a character made with «＋ Nuovo personaggio» (`archui.js:205`). */
export function createdOrigin(clock: Clock): CharacterOrigin {
  return { label: `creato nell'archivio · ${today(clock)}` };
}
