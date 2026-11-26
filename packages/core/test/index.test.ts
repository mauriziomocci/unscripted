import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../src/index';
import * as testing from '../testing/index';

const CONTRACT = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'specs',
  '20261126-130502-wi1-foundation',
  'contracts',
  'core-ports.d.ts',
);

/** The values (not the types) `contracts/core-ports.d.ts` declares, sorted. */
function declaredValues(): string[] {
  const declarations = readFileSync(CONTRACT, 'utf8').matchAll(
    /^export declare (?:const|function|class) (\w+)/gm,
  );
  return [...declarations].map(([, name]) => name ?? '').sort();
}

describe('the public surface of @unscripted/core', () => {
  it('exports exactly the values the contract declares', () => {
    expect(Object.keys(core).sort()).toEqual(declaredValues());
  });

  it('exports for tests exactly the three suites and the in-memory store', () => {
    expect(Object.keys(testing).sort()).toEqual([
      'createMemoryCharacterStore',
      'describeArchiveClient',
      'describeCharacterStore',
      'describeLlmClient',
    ]);
  });
});
