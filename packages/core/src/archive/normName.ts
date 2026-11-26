/**
 * A name as the archive compares it: accents and case folded, whitespace
 * collapsed (`archui.js:18`). Two characters with the same normalised name are
 * the same person for the duplicate mark, the pending relations and the pack.
 */
export function normName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
