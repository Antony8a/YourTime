const UNITS: [limitSeconds: number, divisor: number, unit: Unit][] = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [604800, 86400, 'day'],
  [2629800, 604800, 'week'],
  [31557600, 2629800, 'month'],
  [Infinity, 31557600, 'year'],
];

type Unit = Intl.RelativeTimeFormatUnit;

const SPANISH_UNITS: Record<string, [one: string, many: string]> = {
  second: ['segundo', 'segundos'],
  minute: ['minuto', 'minutos'],
  hour: ['hora', 'horas'],
  day: ['día', 'días'],
  week: ['semana', 'semanas'],
  month: ['mes', 'meses'],
  year: ['año', 'años'],
};

const SPANISH_SPECIAL: Record<string, Record<number, string>> = {
  day: { [-2]: 'anteayer', [-1]: 'ayer', 1: 'mañana', 2: 'pasado mañana' },
  week: { [-1]: 'la semana pasada', 1: 'la próxima semana' },
  month: { [-1]: 'el mes pasado', 1: 'el próximo mes' },
  year: { [-1]: 'el año pasado', 1: 'el próximo año' },
};

/**
 * Hermes (React Native on Android) ships no Intl.RelativeTimeFormat, so Spanish
 * is spelled out by hand there. Other locales fall back to a plain English form.
 */
function relativeFallback(value: number, unit: Unit, locale: string): string {
  const abs = Math.abs(value);
  if (!locale.startsWith('es')) {
    const name = unit + (abs === 1 ? '' : 's');
    return value < 0 ? `${abs} ${name} ago` : `in ${abs} ${name}`;
  }
  const special = SPANISH_SPECIAL[unit]?.[value];
  if (special) return special;
  const [one, many] = SPANISH_UNITS[unit] ?? [unit, unit];
  const text = `${abs} ${abs === 1 ? one : many}`;
  return value < 0 ? `hace ${text}` : `dentro de ${text}`;
}

function formatRelative(value: number, unit: Unit, locale: string): string {
  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
  }
  return relativeFallback(value, unit, locale);
}

/** "hace 5 minutos", "mañana", "dentro de 3 días". */
export function timeAgo(iso: string, now: Date = new Date(), locale = 'es'): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return locale.startsWith('es') ? 'ahora mismo' : 'just now';
  const [, divisor, unit] = UNITS.find(([limit]) => abs < limit)!;
  return formatRelative(Math.round(seconds / divisor), unit, locale);
}

/** "vie, 12 mar, 15:30" */
export function formatDateTime(iso: string, locale = 'es'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "07:05" or "1:02:09": how long something has been running. Never negative. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}
