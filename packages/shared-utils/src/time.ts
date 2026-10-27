import { intlLocale, t, tn } from './i18n';

type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

const UNITS: [limitSeconds: number, divisor: number, unit: Unit][] = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [604800, 86400, 'day'],
  [2629800, 604800, 'week'],
  [31557600, 2629800, 'month'],
  [Infinity, 31557600, 'year'],
];

/** "5 minutos", "1 hora": the amount of time on its own, in the current language. */
function amount(unit: Unit, n: number): string {
  switch (unit) {
    case 'second':
      return tn(n, '{count} segundo', '{count} segundos');
    case 'minute':
      return tn(n, '{count} minuto', '{count} minutos');
    case 'hour':
      return tn(n, '{count} hora', '{count} horas');
    case 'day':
      return tn(n, '{count} día', '{count} días');
    case 'week':
      return tn(n, '{count} semana', '{count} semanas');
    case 'month':
      return tn(n, '{count} mes', '{count} meses');
    case 'year':
      return tn(n, '{count} año', '{count} años');
  }
}

/** The words some distances in time have of their own: "ayer", "mañana". */
function special(unit: Unit, value: number): string | null {
  if (unit === 'day') {
    if (value === -2) return t('anteayer');
    if (value === -1) return t('ayer');
    if (value === 1) return t('mañana');
    if (value === 2) return t('pasado mañana');
  }
  if (unit === 'week') {
    if (value === -1) return t('la semana pasada');
    if (value === 1) return t('la próxima semana');
  }
  if (unit === 'month') {
    if (value === -1) return t('el mes pasado');
    if (value === 1) return t('el próximo mes');
  }
  if (unit === 'year') {
    if (value === -1) return t('el año pasado');
    if (value === 1) return t('el próximo año');
  }
  return null;
}

/**
 * Spelled out with our own texts rather than Intl.RelativeTimeFormat, which
 * Hermes (React Native on Android) does not ship, so every platform reads the same.
 */
function formatRelative(value: number, unit: Unit): string {
  const own = special(unit, value);
  if (own) return own;
  const text = amount(unit, Math.abs(value));
  return value < 0 ? t('hace {text}', { text }) : t('dentro de {text}', { text });
}

/** "hace 5 minutos", "mañana", "dentro de 3 días". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return t('ahora mismo');
  const [, divisor, unit] = UNITS.find(([limit]) => abs < limit)!;
  return formatRelative(Math.round(seconds / divisor), unit);
}

/** "vie, 12 mar, 15:30" */
export function formatDateTime(iso: string, locale = intlLocale()): string {
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
