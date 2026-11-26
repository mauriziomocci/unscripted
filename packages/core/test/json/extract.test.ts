import { describe, expect, it } from 'vitest';
import { extractJson } from '../../src/json/extract';

describe('extractJson', () => {
  it('reads a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('reads a bare array', () => {
    expect(extractJson('[1, 2, 3]')).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('reads the content of a code fence', () => {
    const text = 'Here it is:\n```json\n{"name": "Ada"}\n```\nDone.';
    expect(extractJson(text)).toEqual({ ok: true, value: { name: 'Ada' } });
  });

  it('ignores prose before and after the value', () => {
    const text = 'Sure! {"ok": true} Let me know if you need more.';
    expect(extractJson(text)).toEqual({ ok: true, value: { ok: true } });
  });

  it('is not fooled by braces and brackets inside strings', () => {
    const text = '{"line": "she said {hello} and [left"}';
    expect(extractJson(text)).toEqual({ ok: true, value: { line: 'she said {hello} and [left' } });
  });

  it('is not fooled by escaped quotes inside strings', () => {
    const text = String.raw`{"line": "he said \"stop}\" twice"}`;
    expect(extractJson(text)).toEqual({ ok: true, value: { line: 'he said "stop}" twice' } });
  });

  it('keeps nested arrays and objects together', () => {
    const text = 'x [[1, [2]], {"k": [{"z": []}]}] y';
    expect(extractJson(text)).toEqual({ ok: true, value: [[1, [2]], { k: [{ z: [] }] }] });
  });

  it('returns the first value when there are two', () => {
    expect(extractJson('[1] {"a":2}')).toEqual({ ok: true, value: [1] });
    expect(extractJson('{"a":2} [1]')).toEqual({ ok: true, value: { a: 2 } });
  });
});

describe('extractJson on text that is not an answer', () => {
  it('skips a balanced stretch of prose that is not JSON', () => {
    expect(extractJson('see {the note} then {"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('does not return an inner value of a cut-off answer', () => {
    expect(extractJson('{"a": 1, "b": {"c": 2}')).toEqual({ ok: false });
    expect(extractJson('{ oops {"a":1}')).toEqual({ ok: false });
  });

  it.each(['', 'no json here', '{"a": 1', '[1, [2, 3]', '{"a": "unterminated}', '42', '"text"'])(
    'reports failure for %j',
    (text) => {
      expect(extractJson(text)).toEqual({ ok: false });
    },
  );

  it('does not return an inner value of an answer that is balanced but invalid', () => {
    expect(extractJson('{"azione": {"tipo": "parla"},}')).toEqual({ ok: false });
  });

  it('does not read a value from inside a string of a broken answer', () => {
    expect(extractJson('{"line": "[1,2]",}')).toEqual({ ok: false });
  });

  it('scans a hostile run of 20000 nested braces in linear time', () => {
    const hostile = '{'.repeat(20_000) + '}'.repeat(20_000);
    // eslint-disable-next-line no-restricted-globals -- taste-exempt: a test measures real elapsed time, the pure-core clock rule is for src
    const started = performance.now();
    expect(extractJson(hostile)).toEqual({ ok: false });
    // eslint-disable-next-line no-restricted-globals -- taste-exempt: same measurement as above
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
