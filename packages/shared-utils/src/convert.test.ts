import { describe, expect, it } from 'vitest';
import { convertBudget, convertMinor, roundForDisplay, type Rates } from './convert';

// The same fixed table as the backend tests (domain/rates), so both agree.
const table: Rates = {
  date: '2026-10-21',
  base: 'USD',
  rates: { USD: 1, COP: 4000, EUR: 0.8, JPY: 150 },
};

describe('convertMinor', () => {
  it('matches the backend on the same cases', () => {
    expect(convertMinor(12345, 'COP', 'COP', table)).toBe(12345);
    expect(convertMinor(10000, 'USD', 'COP', table)).toBe(40000000);
    expect(convertMinor(40000000, 'COP', 'USD', table)).toBe(10000);
    expect(convertMinor(8000, 'EUR', 'COP', table)).toBe(40000000);
    expect(convertMinor(1000, 'JPY', 'USD', table)).toBe(667); // yen have no minor unit
    expect(convertMinor(10000, 'USD', 'JPY', table)).toBe(15000);
    expect(convertMinor(100, 'USD', 'EUR', table)).toBe(80);
  });

  it('is null without a rate, but never needs one for the same currency', () => {
    expect(convertMinor(100, 'USD', 'BOB', table)).toBeNull();
    expect(convertMinor(100, 'BOB', 'USD', table)).toBeNull();
    expect(convertMinor(100, 'USD', 'COP', null)).toBeNull();
    expect(convertMinor(100, 'BOB', 'BOB', null)).toBe(100);
  });
});

describe('convertBudget', () => {
  const budget = { type: 'hourly' as const, min_minor: 1000, max_minor: 2000, currency: 'USD' };

  it('converts both ends and keeps the kind of budget', () => {
    expect(convertBudget(budget, 'COP', table)).toEqual({
      type: 'hourly',
      min_minor: 4000000,
      max_minor: 8000000,
      currency: 'COP',
    });
  });

  it('has nothing to say for the same currency, a negotiable budget or a missing rate', () => {
    expect(convertBudget(budget, 'USD', table)).toBeNull();
    expect(convertBudget({ ...budget, min_minor: null, max_minor: null }, 'COP', table)).toBeNull();
    expect(convertBudget(budget, 'BOB', table)).toBeNull();
  });
});

describe('roundForDisplay', () => {
  it('drops the cents of large approximations only', () => {
    expect(roundForDisplay(6307547, 'COP')).toBe(6307500); // 63.075,47 -> 63.075
    expect(roundForDisplay(10050, 'USD')).toBe(10100); // 100,50 -> 101
    expect(roundForDisplay(793, 'USD')).toBe(793); // 7,93 keeps its decimals
    expect(roundForDisplay(9999, 'USD')).toBe(9999); // 99,99 is still under 100
    expect(roundForDisplay(-6307547, 'COP')).toBe(-6307500);
  });

  it('works with currencies that have no minor unit', () => {
    expect(roundForDisplay(15049, 'JPY')).toBe(15049); // already whole units
  });
});
