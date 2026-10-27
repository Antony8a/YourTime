import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCALES, SOURCE_LOCALE, setLocale, t, tn, type Catalog, type Locale } from './i18n';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { pt } from './i18n/pt';
import './i18n/index';
import { timeAgo } from './time';

// The extractor reads the app's code for every text marked with t(), tn() or msg().
const { extractKeys, placeholders } = createRequire(import.meta.url)(
  '../../../scripts/i18n-extract.cjs'
) as {
  extractKeys: () => Map<string, string[]>;
  placeholders: (text: string) => string[];
};

const catalogs: Record<Exclude<Locale, 'es'>, Catalog> = { en, pt, fr };
const used = extractKeys();

afterEach(() => setLocale('es'));

describe('translations', () => {
  it('cover every language we offer', () => {
    const offered = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
    expect(Object.keys(catalogs).sort()).toEqual(offered.sort());
  });

  for (const [locale, catalog] of Object.entries(catalogs)) {
    describe(locale, () => {
      it('has every text the apps show', () => {
        const missing = [...used.keys()].filter((key) => !(key in catalog));
        // Run `node scripts/i18n-extract.cjs --missing <language>` to list them.
        expect(missing, `texts without a ${locale} translation`).toEqual([]);
      });

      it('has no texts nobody uses any more', () => {
        const stale = Object.keys(catalog).filter((key) => !used.has(key));
        expect(stale, `${locale} translations for texts no longer in the code`).toEqual([]);
      });

      it('keeps the {placeholders} of every text', () => {
        const broken = Object.entries(catalog)
          .filter(([key, text]) => placeholders(key).join() !== placeholders(text).join())
          .map(([key]) => key);
        expect(broken, `${locale} translations whose variables differ from the text`).toEqual([]);
      });

      it('leaves nothing blank', () => {
        const blank = Object.entries(catalog)
          .filter(([, text]) => text.trim() === '')
          .map(([key]) => key);
        expect(blank).toEqual([]);
      });
    });
  }
});

describe('using the real catalogs', () => {
  it('translates screens, plurals and variables', () => {
    setLocale('en');
    expect(t('Ingresar')).toBe('Sign in');
    expect(t('Hola, {name}', { name: 'Ana' })).toBe('Hi, Ana');
    expect(tn(1, '{count} postulación', '{count} postulaciones')).toBe('1 application');
    expect(tn(3, '{count} postulación', '{count} postulaciones')).toBe('3 applications');

    setLocale('fr');
    expect(t('Ingresar')).toBe('Se connecter');
    // French counts 0 and 1 as singular.
    expect(tn(0, '{count} postulación', '{count} postulaciones')).toBe('0 candidature');
    expect(tn(2, '{count} postulación', '{count} postulaciones')).toBe('2 candidatures');

    setLocale('pt');
    expect(t('Ingresar')).toBe('Entrar');
    expect(t('{day} de {month} de {year}', { day: 5, month: 'maio', year: 2026 })).toBe(
      '5 de maio de 2026'
    );
  });

  it('reads relative times in each language', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const fiveMinutesAgo = '2026-01-10T11:55:00Z';
    expect(timeAgo(fiveMinutesAgo, now)).toBe('hace 5 minutos');
    setLocale('en');
    expect(timeAgo(fiveMinutesAgo, now)).toBe('5 minutes ago');
    setLocale('pt');
    expect(timeAgo(fiveMinutesAgo, now)).toBe('há 5 minutos');
    setLocale('fr');
    expect(timeAgo(fiveMinutesAgo, now)).toBe('il y a 5 minutes');
  });
});
