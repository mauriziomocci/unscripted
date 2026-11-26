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
);
