/**
 * Date ranges for reports. A range is two calendar days, both inclusive, written
 * as local "YYYY-MM-DD" keys so a day means the same thing everywhere (no time
 * zones in the picker). `from: null, to: null` means all time.
 */

export type DateKey = string;

export interface DateRange {
  from: DateKey | null;
  to: DateKey | null;
}

export const ALL_TIME: DateRange = { from: null, to: null };

export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Monday first, as in most of the Spanish-speaking world. */
export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a key. */
export function parseKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Moves by whole months, landing on the last day when the target month is shorter. */
export function addMonths(key: DateKey, months: number): DateKey {
  const d = parseKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
}

export const startOfMonth = (key: DateKey): DateKey => `${key.slice(0, 8)}01`;

export function endOfMonth(key: DateKey): DateKey {
  const d = parseKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Days from `a` to `b`, counting both ends (a single day is 1). */
export function daysInRange(a: DateKey, b: DateKey): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000) + 1;
}

export const earlier = (a: DateKey, b: DateKey): DateKey => (a <= b ? a : b);

// ---- presets ------------------------------------------------------------------

export type PresetId = 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all';

export const PRESETS: readonly { id: PresetId; label: string }[] = [
  { id: 'last7', label: '7 días' },
  { id: 'last30', label: '30 días' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes pasado' },
  { id: 'thisYear', label: 'Este año' },
  { id: 'all', label: 'Todo' },
];

export function presetRange(id: PresetId, today: Date): DateRange {
  const t = toKey(today);
  switch (id) {
    case 'last7':
      return { from: addDays(t, -6), to: t };
    case 'last30':
      return { from: addDays(t, -29), to: t };
    case 'thisMonth':
      return { from: startOfMonth(t), to: t };
    case 'lastMonth': {
      const prev = addMonths(startOfMonth(t), -1);
      return { from: prev, to: endOfMonth(prev) };
    }
    case 'thisYear':
      return { from: `${t.slice(0, 4)}-01-01`, to: t };
    case 'all':
      return ALL_TIME;
  }
}

export const sameRange = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;

/** Which preset a range equals today, or 'custom'. */
export function matchPreset(range: DateRange, today: Date): PresetId | 'custom' {
  for (const p of PRESETS) if (sameRange(range, presetRange(p.id, today))) return p.id;
  return 'custom';
}

// ---- stepping -----------------------------------------------------------------

/** Whether the arrows can move this range: not "all time", and never into the future. */
export function canShift(range: DateRange, dir: -1 | 1, today: Date): boolean {
  if (range.from === null || range.to === null) return false;
  return dir === -1 ? true : range.to < toKey(today);
}

/**
 * The same kind of period, one step back or forward: a month for a month view
 * (this month so far counts), a year for a year view, otherwise the same number
 * of days. Forward never passes today.
 */
export function shiftRange(range: DateRange, dir: -1 | 1, today: Date): DateRange {
  if (!canShift(range, dir, today) || range.from === null || range.to === null) return range;
  const { from, to } = range;
  const t = toKey(today);

  let next: { from: DateKey; to: DateKey };
  if (from.endsWith('-01') && to === earlier(endOfMonth(from), t)) {
    const start = addMonths(from, dir);
    next = { from: start, to: endOfMonth(start) };
  } else if (from.slice(5) === '01-01' && to === earlier(`${from.slice(0, 4)}-12-31`, t)) {
    const year = Number(from.slice(0, 4)) + dir;
    next = { from: `${year}-01-01`, to: `${year}-12-31` };
  } else {
    const size = daysInRange(from, to);
    next = { from: addDays(from, dir * size), to: addDays(to, dir * size) };
  }
  return { from: next.from, to: earlier(next.to, t) };
}

// ---- API ----------------------------------------------------------------------

/**
 * The instants a range covers: `from` is the start of the first day, `to` the
 * start of the day after the last (exclusive), both in the device's time zone.
 */
export function rangeBounds(range: DateRange): { from?: Date; to?: Date } {
  return {
    from: range.from ? parseKey(range.from) : undefined,
    to: range.to ? parseKey(addDays(range.to, 1)) : undefined,
  };
}

// ---- display ------------------------------------------------------------------

const short = (key: DateKey) => MONTHS[Number(key.slice(5, 7)) - 1]!.slice(0, 3);
const dayOf = (key: DateKey) => Number(key.slice(8, 10));

/** "12 oct 2026" */
export function formatDay(key: DateKey): string {
  return `${dayOf(key)} ${short(key)} ${key.slice(0, 4)}`;
}

/** "1 – 31 oct 2026", "28 sep – 5 oct 2026", "Todo el historial". */
export function formatRange(range: DateRange): string {
  const { from, to } = range;
  if (!from && !to) return 'Todo el historial';
  if (from && !to) return `Desde ${formatDay(from)}`;
  if (!from && to) return `Hasta ${formatDay(to)}`;
  const a = from as DateKey;
  const b = to as DateKey;
  if (a === b) return formatDay(a);
  if (a.slice(0, 7) === b.slice(0, 7))
    return `${dayOf(a)} – ${dayOf(b)} ${short(b)} ${b.slice(0, 4)}`;
  if (a.slice(0, 4) === b.slice(0, 4))
    return `${dayOf(a)} ${short(a)} – ${dayOf(b)} ${short(b)} ${b.slice(0, 4)}`;
  return `${formatDay(a)} – ${formatDay(b)}`;
}

/** "octubre 2026" */
export function formatMonth(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export interface CalendarCell {
  key: DateKey;
  day: number;
  inMonth: boolean;
}

/** Weeks (Monday first) covering `month` (0-11), padded with the neighbours' days. */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const grid: CalendarCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(year, month, 1 - offset + w * 7 + d);
      row.push({ key: toKey(date), day: date.getDate(), inMonth: date.getMonth() === month });
    }
    grid.push(row);
  }
  return grid;
}
