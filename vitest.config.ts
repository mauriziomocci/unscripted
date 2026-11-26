import { configDefaults, defineConfig } from 'vitest/config';

/** One Vitest project per workspace, plus the repository scripts. */
const PROJECT_ROOTS = [
  'packages/core',
  'packages/ui',
  'apps/web',
  'apps/server',
  'apps/artifact',
  'tools/golden',
  'scripts',
  'eslint-rules',
];

/**
 * Coverage floors of FR-004: the pure core carries the game rules, so it has
 * the highest floor; rendering code has the lowest.
 */
const FLOORS = {
  'packages/core/**': { lines: 90, branches: 90 },
  'apps/server/**': { lines: 80, branches: 80 },
  'packages/ui/**': { lines: 70, branches: 70 },
  'apps/web/**': { lines: 70, branches: 70 },
};

export default defineConfig({
  test: {
    projects: PROJECT_ROOTS.map((root) => ({
      // The vendored legacy tests are Node scripts, not Vitest suites: discovery skips them.
      test: { name: root, root, exclude: [...configDefaults.exclude, '**/legacy/**'] },
    })),
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**', 'tools/*/src/**'],
      // The legacy folder is vendored reference code, migrations are generated.
      exclude: ['apps/artifact/legacy/**', 'apps/server/drizzle/**', '**/*.d.ts'],
      thresholds: FLOORS,
    },
  },
});
