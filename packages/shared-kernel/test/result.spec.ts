import { describe, expect, it } from 'vitest';

import { err, flatMap, isErr, isOk, map, ok, unwrapOr } from '../src/result/result.js';

describe('Result', () => {
  it('creates ok and err variants', () => {
    const success = ok(42);
    const failure = err('something went wrong');

    expect(success).toEqual({ ok: true, value: 42 });
    expect(failure).toEqual({ ok: false, error: 'something went wrong' });
  });

  it('narrows with isOk and isErr', () => {
    const success = ok('value');
    const failure = err(new Error('fail'));

    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);
  });

  it('maps success values without touching errors', () => {
    const doubled = map(ok(2), (value) => value * 2);
    const unchanged = map(err('nope'), (value: number) => value * 2);

    expect(doubled).toEqual({ ok: true, value: 4 });
    expect(unchanged).toEqual({ ok: false, error: 'nope' });
  });

  it('flatMaps chained operations', () => {
    const parsePositive = (value: number) =>
      value > 0 ? ok(value) : err('must be positive');

    const chained = flatMap(ok(3), parsePositive);
    const failed = flatMap(ok(-1), parsePositive);
    const shortCircuited = flatMap(err('upstream'), parsePositive);

    expect(chained).toEqual({ ok: true, value: 3 });
    expect(failed).toEqual({ ok: false, error: 'must be positive' });
    expect(shortCircuited).toEqual({ ok: false, error: 'upstream' });
  });

  it('unwraps success values or returns a default', () => {
    expect(unwrapOr(ok('present'), 'missing')).toBe('present');
    expect(unwrapOr(err('gone'), 'missing')).toBe('missing');
  });
});