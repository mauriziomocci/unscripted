import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toJsonSchema } from '../../src/schema/toJsonSchema';

/** Stand-in for the answer schema of the `probe` call: a two-field object (research R-10). */
const PROBE_ANSWER = z.object({ ok: z.boolean(), reply: z.string() });

describe('toJsonSchema', () => {
  it('turns the probe answer schema into the committed JSON Schema', () => {
    expect(toJsonSchema(PROBE_ANSWER)).toMatchInlineSnapshot(`
      {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "additionalProperties": false,
        "properties": {
          "ok": {
            "type": "boolean",
          },
          "reply": {
            "type": "string",
          },
        },
        "required": [
          "ok",
          "reply",
        ],
        "type": "object",
      }
    `);
  });

  it('gives a plain JSON document that survives a round trip', () => {
    const schema = toJsonSchema(PROBE_ANSWER);
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });
});

describe('the zod dependency of core', () => {
  const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

  it('is taken from the workspace catalog', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'packages/core/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies?.['zod']).toBe('catalog:');
  });

  it('is pinned to ~4.6.7 by that catalog, one version for every workspace', () => {
    const catalog = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
    expect(catalog).toMatch(/^ {2}zod: ~4\.6\.7$/m);
  });
});
