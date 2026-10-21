import { describe, expect, it } from 'vitest';
import {
  ALL_TIME,
  addMonths,
  canShift,
  formatRange,
  matchPreset,
  monthGrid,
  presetRange,
  rangeBounds,
  shiftRange,
  toKey,
} from './period';

const today = new Date(2026, 9, 21); // 21 Oct 2026, a Wednesday

describe('presets', () => {
  it('covers inclusive days ending today', () => {
    expect(presetRange('last7', today)).toEqual({ from: '2026-10-15', to: '2026-10-21' });
    expect(presetRange('last30', today)).toEqual({ from: '2026-09-22', to: '2026-10-21' });
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-21' });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('thisYear', today)).toEqual({ from: '2026-01-01', to: '2026-10-21' });
    expect(presetRange('all', today)).toEqual(ALL_TIME);
  });

  it('recognises a preset, or says custom', () => {
    expect(matchPreset(presetRange('lastMonth', today), today)).toBe('lastMonth');
    expect(matchPreset({ from: '2026-10-02', to: '2026-10-09' }, today)).toBe('custom');
  });

  it('handles January for "last month"', () => {
    expect(presetRange('lastMonth', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
});

describe('addMonths', () => {
  it('clamps to the last day of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('shiftRange', () => {
  it('steps a month view by whole months, including this month so far', () => {
    expect(shiftRange(presetRange('thisMonth', today), -1, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(shiftRange({ from: '2026-09-01', to: '2026-09-30' }, 1, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-21',
    });
    expect(shiftRange({ from: '2026-02-01', to: '2026-02-28' }, -1, today)).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it('does not mistake a short custom range on the 1st for a month', () => {
    expect(shiftRange({ from: '2026-10-01', to: '2026-10-05' }, 1, today)).toEqual({
      from: '2026-10-06',
      to: '2026-10-10',
    });
  });

  it('steps a year view by years', () => {
    expect(shiftRange(presetRange('thisYear', today), -1, today)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });

  it('steps any other range by its own length', () => {
    expect(shiftRange({ from: '2026-10-15', to: '2026-10-21' }, -1, today)).toEqual({
      from: '2026-10-08',
      to: '2026-10-14',
    });
    expect(shiftRange({ from: '2026-10-02', to: '2026-10-04' }, 1, today)).toEqual({
      from: '2026-10-05',
      to: '2026-10-07',
    });
  });

  it('never moves into the future or shifts all time', () => {
    expect(canShift(presetRange('last7', today), 1, today)).toBe(false);
    expect(canShift(ALL_TIME, -1, today)).toBe(false);
    expect(shiftRange({ from: '2026-10-15', to: '2026-10-21' }, 1, today)).toEqual({
      from: '2026-10-15',
      to: '2026-10-21',
    });
    // A forward step that overshoots today is cut at today.
    expect(shiftRange({ from: '2026-10-10', to: '2026-10-19' }, 1, today).to).toBe('2026-10-21');
  });
});

describe('rangeBounds', () => {
  it('runs from the first midnight to the midnight after the last day', () => {
    const { from, to } = rangeBounds({ from: '2026-10-01', to: '2026-10-31' });
    expect(toKey(from!)).toBe('2026-10-01');
    expect(to!.getHours()).toBe(0);
    expect(toKey(to!)).toBe('2026-11-01');
  });

  it('leaves open ends open', () => {
    expect(rangeBounds(ALL_TIME)).toEqual({ from: undefined, to: undefined });
    expect(rangeBounds({ from: '2026-10-01', to: null }).to).toBeUndefined();
  });
});

describe('formatRange', () => {
  it('reads naturally', () => {
    expect(formatRange(ALL_TIME)).toBe('Todo el historial');
    expect(formatRange({ from: '2026-10-12', to: '2026-10-12' })).toBe('12 oct 2026');
    expect(formatRange({ from: '2026-10-01', to: '2026-10-31' })).toBe('1 – 31 oct 2026');
    expect(formatRange({ from: '2026-09-28', to: '2026-10-05' })).toBe('28 sep – 5 oct 2026');
    expect(formatRange({ from: '2025-12-28', to: '2026-01-05' })).toBe('28 dic 2025 – 5 ene 2026');
  });
});

describe('monthGrid', () => {
  it('starts on Monday and pads with neighbouring days', () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid[0]![0]).toEqual({ key: '2026-09-28', day: 28, inMonth: false });
    expect(grid[0]![3]).toEqual({ key: '2026-10-01', day: 1, inMonth: true });
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.at(-1)!.some((c) => c.key === '2026-10-31')).toBe(true);
  });

  it('uses only as many weeks as the month needs', () => {
    expect(monthGrid(2027, 1)).toHaveLength(4); // Feb 2027 starts on a Monday and has 28 days
    expect(monthGrid(2026, 1)).toHaveLength(5); // Feb 2026 starts on a Sunday
  });
});
