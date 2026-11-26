import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One exemption of the taste gate that carries no written reason. */
export interface Violation {
  /** Path relative to the scanned root. */
  file: string;
  /** 1-based line of the directive. */
  line: number;
  message: string;
}

/** Folders never scanned: vendored or generated code, and the checker's own fixtures. */
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'legacy',
  'drizzle',
  'fixtures',
]);

const ESLINT_DISABLE = /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?\b/;
const JSCPD_IGNORE = /(?:\/\/|\/\*)\s*jscpd:ignore-start/;
const WRITTEN_REASON = /taste-exempt:\s*\S/;

function violationInLine(line: string): string | undefined {
  if (WRITTEN_REASON.test(line)) return undefined;
  if (ESLINT_DISABLE.test(line)) return 'eslint-disable without "taste-exempt: <reason>"';
  return JSCPD_IGNORE.test(line) ? 'jscpd ignore without "taste-exempt: <reason>"' : undefined;
}

function typeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : typeScriptFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Lists every exemption of the taste gate under `root` that lacks a written
 * reason. Vendored folders (`legacy`, `drizzle`) and `fixtures` are skipped.
 */
export function findUnjustifiedExemptions(root: string): Violation[] {
  return typeScriptFiles(root).flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .flatMap((text, index) => {
        const message = violationInLine(text);
        return message ? [{ file: relative(root, path), line: index + 1, message }] : [];
      }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = findUnjustifiedExemptions(process.cwd());
  for (const { file, line, message } of violations)
    console.error(`${file}:${String(line)}: ${message}`);
  process.exitCode = violations.length > 0 ? 1 : 0;
}
