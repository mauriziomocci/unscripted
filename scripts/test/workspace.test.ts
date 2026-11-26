import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

const EXPECTED_WORKSPACES = [
  '@unscripted/artifact',
  '@unscripted/core',
  '@unscripted/golden',
  '@unscripted/server',
  '@unscripted/ui',
  '@unscripted/web',
];

/** Reads the `packages:` list of pnpm-workspace.yaml (a flat list of globs). */
function declaredPatterns(): string[] {
  const lines = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8').split('\n');
  const start = lines.indexOf('packages:');
  const patterns: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^ {2}- (\S+)$/.exec(line);
    if (!match?.[1]) break;
    patterns.push(match[1]);
  }
  return patterns;
}

function directoriesOf(pattern: string): string[] {
  if (!pattern.endsWith('/*')) return [pattern];
  const parent = pattern.slice(0, -2);
  return readdirSync(join(ROOT, parent)).map((name) => `${parent}/${name}`);
}

function workspaceNames(): string[] {
  return declaredPatterns()
    .flatMap(directoriesOf)
    .filter((dir) => existsSync(join(ROOT, dir, 'package.json')))
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as {
        name: string;
      };
      return manifest.name;
    })
    .sort();
}

describe('pnpm workspaces', () => {
  it('declare exactly the six workspaces of A-01', () => {
    expect(workspaceNames()).toEqual(EXPECTED_WORKSPACES);
  });
});
