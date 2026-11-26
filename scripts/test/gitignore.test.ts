import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

/** `git check-ignore -q` exits 0 when the path is ignored and 1 when it is not. */
function isIgnored(path: string): boolean {
  const result = spawnSync('git', ['check-ignore', '-q', path], { cwd: ROOT });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore failed: ${result.stderr.toString()}`);
  }
  return result.status === 0;
}

describe('.gitignore', () => {
  it.each([
    '.envs/.local/server.env',
    '.envs/.production/server.env',
    'backups/x.sql',
    'apps/artifact/dist/index.html',
  ])('ignores %s', (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  it.each(['.envs/.local/server.env.example', '.envs/.production/web.env.example'])(
    'does not ignore the committed template %s',
    (path) => {
      expect(isIgnored(path)).toBe(false);
    },
  );
});
