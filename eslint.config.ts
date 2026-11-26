import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import boundaries from 'eslint-plugin-boundaries';
import { importX } from 'eslint-plugin-import-x';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** The vendored reference code may be read only by the builder and the golden harness. */
const LEGACY_IMPORT = {
  group: ['**/legacy/**'],
  message:
    'apps/artifact/legacy is vendored: only the artifact builder and the golden harness read it.',
};

/**
 * Root flat config, loaded through Node's native TypeScript support (the
 * `--flag` of the lint script) so no loader dependency is needed.
 * Everything outside the vendored legacy folder is linted with the strict,
 * type-aware typescript-eslint rules (FR-003).
 */
export default defineConfig(
  {
    ignores: [
      'apps/artifact/legacy/**',
      '**/dist/**',
      'apps/server/drizzle/**',
      'coverage/**',
      // Contract drafts of the specs, not product code.
      'specs/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // A cycle is a runtime problem; import-x ignores type-only imports (A-02).
    files: ['**/*.{ts,tsx}'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
      // Without these two, import-x only walks .js files and never sees a .ts cycle.
      'import-x/extensions': ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
    },
    rules: { 'import-x/no-cycle': 'error' },
  },
  {
    // Dependencies point one way: core <- ui <- apps, golden -> core (A-02).
    files: ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}', 'tools/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // Both resolvers read the tsconfig paths and the workspace links; the
      // boundaries plugin reads the first, import-x the second (research R-04).
      'import/resolver': {
        typescript: { project: ['*/*/tsconfig.json'], noWarnOnMultipleProjects: true },
      },
      'boundaries/elements': [
        { type: 'core', pattern: 'packages/core' },
        { type: 'ui', pattern: 'packages/ui' },
        { type: 'app-web', pattern: 'apps/web' },
        { type: 'app-server', pattern: 'apps/server' },
        { type: 'app-artifact', pattern: 'apps/artifact' },
        { type: 'golden', pattern: 'tools/golden' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // A file may always import its own element.
            { from: { element: { type: 'core' } }, allow: { to: { element: { type: 'core' } } } },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: ['ui', 'core'] } } },
            },
            {
              from: { element: { type: 'app-web' } },
              allow: { to: { element: { types: ['app-web', 'ui', 'core'] } } },
            },
            {
              from: { element: { type: 'app-server' } },
              allow: { to: { element: { types: ['app-server', 'core'] } } },
            },
            {
              from: { element: { type: 'app-artifact' } },
              allow: { to: { element: { types: ['app-artifact', 'ui', 'core'] } } },
            },
            {
              from: { element: { type: 'golden' } },
              allow: { to: { element: { types: ['golden', 'core'] } } },
            },
          ],
        },
      ],
    },
  },
  {
    // The pure core reaches time, timers and randomness only through ports (A-03).
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['performance', 'setTimeout', 'setInterval', 'crypto'].map((name) => ({
          name,
          message: 'packages/core is pure: use the Clock, Scheduler or Rng port.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Math.random() is forbidden in core: use the Rng port.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Date.now() is forbidden in core: use the Clock port.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'new Date() without an argument reads the clock: use the Clock port.',
        },
      ],
    },
  },
  {
    // Route handlers reach data only through injected services (FR-020).
    files: ['apps/server/src/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            LEGACY_IMPORT,
            {
              group: ['drizzle-orm', 'drizzle-orm/*', 'pg', '**/db/**'],
              message: 'Route handlers use services from deps; the ORM and the driver stay in db/.',
            },
          ],
        },
      ],
    },
  },
  {
    // Routes are left out because their own block repeats this pattern: the options
    // of one rule do not merge across blocks.
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'apps/artifact/src/build/**',
      'apps/artifact/test/**',
      'tools/golden/**',
      'scripts/generate-pack-content.ts',
      'apps/server/src/routes/**',
    ],
    rules: { 'no-restricted-imports': ['error', { patterns: [LEGACY_IMPORT] }] },
  },
  {
    // LLM output is untrusted data: no component injects HTML (S-05). Core has its own
    // no-restricted-syntax list (rule options replace each other across blocks) and its
    // .ts files cannot hold JSX.
    files: ['**/*.{ts,tsx}'],
    ignores: ['packages/core/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned: render text, never injected HTML.',
        },
      ],
    },
  },
);
