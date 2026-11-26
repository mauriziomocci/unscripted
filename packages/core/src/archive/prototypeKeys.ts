/** Keys that, once copied into a plain object, can reach or replace the prototype chain. */
const PROTOTYPE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Whether a value holds a prototype-polluting key (`__proto__`, `constructor`,
 * `prototype`) as an own key at any depth, arrays included. Imported documents
 * are checked with this before anything else touches them (FR-013), so no
 * later merge or copy can be poisoned. The walk uses its own stack, not
 * recursion, so a hostile document nested thousands of levels deep cannot
 * overflow the call stack.
 */
export function hasPrototypeKey(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== 'object' || current === null) continue;
    for (const key of Object.keys(current)) {
      if (PROTOTYPE_KEYS.has(key)) return true;
      pending.push(Reflect.get(current, key));
    }
  }
  return false;
}
