import boundaries from 'eslint-plugin-boundaries';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

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
);
