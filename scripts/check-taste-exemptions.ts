import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One exemption of the taste gate that carries no written reason. */
export interface Violation {
  /** Path relative to the scanned root. */
  file: string;
  /** 1-based line of the directive. */
  line: number;
  message: string;
}

/**
 * Paths never scanned, exact prefixes relative to the repository root: the
 * vendored reference code, generated migrations and the checker's own fixtures.
 */
const EXCLUDED_PREFIXES = [
  'apps/artifact/legacy/',
  'apps/server/drizzle/',
  'scripts/test/fixtures/',
];

/** Every comment that switches a rule off or changes what ESLint knows: disables, inline config, env, globals. */
const ESLINT_DIRECTIVE =
  /(?:\/\/\s*eslint-disable(?:-next-line|-line)?\b|\/\*\s*(?:eslint-disable(?:-next-line|-line)?\b|eslint-env\b|eslint\s+[^\s:]+\s*:|globals?\s))/;
const JSCPD_IGNORE = /(?:\/\/|\/\*)\s*jscpd:ignore-start/;
const WRITTEN_REASON = /taste-exempt:\s*\S/;

function violationInLine(line: string): string | undefined {
  if (WRITTEN_REASON.test(line)) return undefined;
  if (ESLINT_DIRECTIVE.test(line)) return 'ESLint directive without "taste-exempt: <reason>"';
  return JSCPD_IGNORE.test(line) ? 'jscpd ignore without "taste-exempt: <reason>"' : undefined;
}

/** Files git tracks or would track (so .gitignore applies), relative to `root`. */
function sourceFiles(root: string): string[] {
  const listed = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  return listed
    .split('\0')
    .sort()
    .filter((file) => /\.(?:tsx?|[cm]?js)$/.test(file))
    .filter((file) => !EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix)))
    .filter((file) => existsSync(join(root, file)));
}

/**
 * Lists every exemption of the taste gate under `root` that lacks a written
 * reason. Ignored files and the exact paths of EXCLUDED_PREFIXES are skipped.
 */
export function findUnjustifiedExemptions(root: string): Violation[] {
  return sourceFiles(root).flatMap((file) =>
    readFileSync(join(root, file), 'utf8')
      .split('\n')
      .flatMap((text, index) => {
        const message = violationInLine(text);
        return message ? [{ file, line: index + 1, message }] : [];
      }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = findUnjustifiedExemptions(process.cwd());
  for (const { file, line, message } of violations)
    console.error(`${file}:${String(line)}: ${message}`);
  process.exitCode = violations.length > 0 ? 1 : 0;
}
