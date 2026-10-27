/**
 * A small translation layer. The source language is Spanish and the Spanish text
 * itself is the key: `t('Iniciar sesión')`. A language without an entry for a text
 * shows the Spanish, never an empty string or a made-up key.
 *
 * It lives here, not in the app, because the formatting helpers in this package
 * (relative time, distances, budgets) produce text too.
 */

export type Locale = 'es' | 'en' | 'pt' | 'fr';

export const SOURCE_LOCALE: Locale = 'es';

/** Languages a person can choose, each named in its own language. */
export const LOCALES: readonly { code: Locale; name: string }[] = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
];

export type Catalog = Readonly<Record<string, string>>;

const catalogs: Partial<Record<Locale, Catalog>> = {};
let current: Locale = SOURCE_LOCALE;

/** Installs the translations of one language. Spanish needs none. */
export function registerCatalog(locale: Locale, catalog: Catalog): void {
  catalogs[locale] = catalog;
}

export const getLocale = (): Locale => current;

export function setLocale(locale: Locale): void {
  current = locale;
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/**
 * Maps any language tag ("es-CO", "pt_BR", "fr") to a language we have. With no
 * match it falls back to English, the most widely understood.
 */
export function resolveLocale(tag: string | null | undefined, fallback: Locale = 'en'): Locale {
  const base = (tag ?? '').toLowerCase().replace('_', '-').split('-')[0];
  return isLocale(base) ? base : fallback;
}

/** The tag to hand to `Intl` for a language, so numbers and dates follow it. */
export function intlLocale(locale: Locale = current): string {
  return locale === 'pt' ? 'pt-BR' : locale;
}

/**
 * Marks a text for translation without translating it now. For texts kept in
 * constants at module level; translate them where they are shown: `t(label)`.
 */
export const msg = <T extends string>(text: T): T => text;

function interpolate(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  );
}

/** Translates `text` into the current language and fills in `{name}` placeholders. */
export function t(text: string, params?: Readonly<Record<string, string | number>>): string {
  const translated = current === SOURCE_LOCALE ? text : (catalogs[current]?.[text] ?? text);
  return interpolate(translated, params);
}

/**
 * Whether `count` takes the singular form. French and Portuguese count 0 and 1
 * as singular; Spanish and English only 1.
 */
export function isSingular(count: number, locale: Locale = current): boolean {
  return locale === 'fr' || locale === 'pt' ? count >= 0 && count < 2 : count === 1;
}

/**
 * Picks the singular or plural text for `count` and translates it. Both texts
 * may use `{count}`: `tn(n, '{count} servicio', '{count} servicios')`.
 */
export function tn(
  count: number,
  one: string,
  other: string,
  params?: Readonly<Record<string, string | number>>
): string {
  return t(isSingular(count) ? one : other, { count, ...params });
}
