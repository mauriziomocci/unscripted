import { describe, expect, it } from 'vitest';
import config from '../../vitest.config.ts';

const coverage = config.test?.coverage;

describe('root vitest configuration', () => {
  it('measures coverage with v8', () => {
    expect(coverage?.provider).toBe('v8');
  });

  it('sets the coverage floors of FR-004 per workspace', () => {
    expect(coverage?.thresholds).toMatchObject({
      'packages/core/**': { lines: 90, branches: 90 },
      'apps/server/**': { lines: 80, branches: 80 },
      'packages/ui/**': { lines: 70, branches: 70 },
      'apps/web/**': { lines: 70, branches: 70 },
    });
  });

  it('excludes from coverage only the legacy folder, migrations and declarations', () => {
    expect(coverage?.exclude).toEqual([
      'apps/artifact/legacy/**',
      'apps/server/drizzle/**',
      '**/*.d.ts',
    ]);
  });
});
