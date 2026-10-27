import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currencyDecimals,
  formatBudget,
  formatPercent,
  fromMinor,
  parseAmount,
  toMinor,
} from './currency';
import { formatDistance } from './distance';
import { formatElapsed, timeAgo } from './time';

describe('minor units', () => {
  it('respects currencies without decimals', () => {
    expect(currencyDecimals('COP')).toBe(2);
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('clp')).toBe(0);
    expect(toMinor(1500, 'JPY')).toBe(1500);
    expect(toMinor(15.99, 'USD')).toBe(1599);
    expect(fromMinor(1599, 'USD')).toBe(15.99);
  });

  it('avoids floating point drift', () => {
    expect(toMinor(0.1 + 0.2, 'USD')).toBe(30);
    expect(toMinor(1.005, 'USD')).toBe(101);
  });
});

describe('parseAmount', () => {
  it.each([
    ['80000', 80000],
    ['80.000', 80000],
    ['80,000', 80000],
    ['1.500,50', 1500.5],
    ['1,500.50', 1500.5],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['$ 2 500', 2500],
    ['1.234.567', 1234567],
  ])('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '0', '-5', '.'])('rejects %j', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('formatBudget', () => {
  const base = { currency: 'USD' } as const;
  it('handles every budget type', () => {
    expect(formatBudget({ ...base, type: 'negotiable', min_minor: null, max_minor: null })).toBe(
      'A convenir'
    );
    expect(formatBudget({ ...base, type: 'fixed', min_minor: 5000, max_minor: 5000 })).toMatch(
      /50/
    );
    expect(formatBudget({ ...base, type: 'hourly', min_minor: 2000, max_minor: 3000 })).toMatch(
      /\/ h$/
    );
    expect(formatBudget({ ...base, type: 'fixed', min_minor: 2000, max_minor: 3000 })).toContain(
      '–'
    );
  });
});

describe('formatDistance', () => {
  it('uses metres under a kilometre and rounds larger values', () => {
    expect(formatDistance(0.43)).toBe('430 m');
    expect(formatDistance(0.004)).toBe('10 m');
    expect(formatDistance(3.24)).toMatch(/3,2 km/);
    expect(formatDistance(240.4)).toBe('240 km');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  it('describes past and future', () => {
    expect(timeAgo('2026-01-10T11:59:50Z', now)).toBe('ahora mismo');
    expect(timeAgo('2026-01-10T11:00:00Z', now)).toMatch(/1 hora|hace 1 h/);
    expect(timeAgo('2026-01-12T12:00:00Z', now)).toMatch(/pasado mañana|2 días/);
  });
});

describe('timeAgo without Intl.RelativeTimeFormat (Hermes on Android)', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  afterEach(() => vi.unstubAllGlobals());

  it('still reads naturally in Spanish', () => {
    vi.stubGlobal('Intl', { ...Intl, RelativeTimeFormat: undefined });
    expect(timeAgo('2026-01-10T11:55:00Z', now)).toBe('hace 5 minutos');
    expect(timeAgo('2026-01-10T11:00:00Z', now)).toBe('hace 1 hora');
    expect(timeAgo('2026-01-09T12:00:00Z', now)).toBe('ayer');
    expect(timeAgo('2026-01-11T12:00:00Z', now)).toBe('mañana');
    expect(timeAgo('2026-01-07T12:00:00Z', now)).toBe('hace 3 días');
    expect(timeAgo('2026-01-13T12:00:00Z', now)).toBe('dentro de 3 días');
  });
});

describe('formatElapsed', () => {
  it('formats minutes and hours and never goes negative', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(3_729_000)).toBe('1:02:09');
    expect(formatElapsed(-5000)).toBe('00:00');
  });
});

describe('formatPercent', () => {
  it('shows basis points as a percentage, in the language', () => {
    expect(formatPercent(1000, 'en')).toBe('10%');
    expect(formatPercent(250, 'en')).toBe('2.5%');
    expect(formatPercent(0, 'en')).toBe('0%');
    expect(formatPercent(10000, 'en')).toBe('100%');
    expect(formatPercent(1000, 'es').replace(/\s/g, '')).toBe('10%');
  });
});
