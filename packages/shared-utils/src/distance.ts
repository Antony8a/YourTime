import { intlLocale } from './i18n';

/** "850 m", "3,2 km", "240 km". Rounds sensibly for humans. */
export function formatDistance(km: number, locale = intlLocale()): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rounded)} km`;
}
