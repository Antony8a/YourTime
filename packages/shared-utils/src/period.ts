import { msg, t } from './i18n';

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

/** Month names, as texts to translate where they are shown: `t(MONTHS[i])`. */
export const MONTHS = [
  msg('enero'),
  msg('febrero'),
  msg('marzo'),
  msg('abril'),
  msg('mayo'),
  msg('junio'),
  msg('julio'),
  msg('agosto'),
  msg('septiembre'),
  msg('octubre'),
  msg('noviembre'),
  msg('diciembre'),
] as const;

/** Abbreviated months. Their own texts: cutting the full name gives "jui" for both June and July. */
export const MONTHS_SHORT = [
  msg('ene'),
  msg('feb'),
  msg('mar'),
  msg('abr'),
  msg('may'),
  msg('jun'),
  msg('jul'),
  msg('ago'),
  msg('sep'),
  msg('oct'),
  msg('nov'),
  msg('dic'),
] as const;

/** The name of a month (0-11) in the current language. */
export const monthName = (month: number): string => t(MONTHS[month]!);

/** Monday first, as in most of the Spanish-speaking world. */
/** Monday first. One letter each; "X" is Wednesday so no two share a text. Translate with `t(letter)`. */
export const WEEKDAYS = [
  msg('L'),
  msg('M'),
  msg('X'),
  msg('J'),
  msg('V'),
  msg('S'),
  msg('D'),
] as const;

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
  { id: 'last7', label: msg('7 días') },
  { id: 'last30', label: msg('30 días') },
  { id: 'thisMonth', label: msg('Este mes') },
  { id: 'lastMonth', label: msg('Mes pasado') },
  { id: 'thisYear', label: msg('Este año') },
  { id: 'all', label: msg('Todo') },
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

const short = (key: DateKey) => t(MONTHS_SHORT[Number(key.slice(5, 7)) - 1]!);
const dayOf = (key: DateKey) => Number(key.slice(8, 10));

/** "12 oct 2026" */
export function formatDay(key: DateKey): string {
  return `${dayOf(key)} ${short(key)} ${key.slice(0, 4)}`;
}

/** "1 – 31 oct 2026", "28 sep – 5 oct 2026", "Todo el historial". */
export function formatRange(range: DateRange): string {
  const { from, to } = range;
  if (!from && !to) return t('Todo el historial');
  if (from && !to) return t('Desde {date}', { date: formatDay(from) });
  if (!from && to) return t('Hasta {date}', { date: formatDay(to) });
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
  return `${monthName(month)} ${year}`;
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
