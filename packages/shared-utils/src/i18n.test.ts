import { afterEach, describe, expect, it } from 'vitest';
import {
  intlLocale,
  isSingular,
  msg,
  registerCatalog,
  resolveLocale,
  setLocale,
  t,
  tn,
} from './i18n';

afterEach(() => setLocale('es'));

describe('t', () => {
  it('returns the Spanish source text untouched', () => {
    expect(t('Iniciar sesión')).toBe('Iniciar sesión');
  });

  it('translates when the language has the text, and falls back to Spanish when it does not', () => {
    registerCatalog('en', { 'Iniciar sesión': 'Sign in' });
    setLocale('en');
    expect(t('Iniciar sesión')).toBe('Sign in');
    expect(t('Texto sin traducir')).toBe('Texto sin traducir');
  });

  it('fills placeholders, in any word order, and leaves unknown ones visible', () => {
    registerCatalog('en', { 'Se postuló {when}': 'Applied {when}' });
    expect(t('Se postuló {when}', { when: 'hoy' })).toBe('Se postuló hoy');
    setLocale('en');
    expect(t('Se postuló {when}', { when: 'today' })).toBe('Applied today');
    expect(t('Hola {nombre}')).toBe('Hola {nombre}');
  });

  it('msg only marks a text; translating happens where it is shown', () => {
    registerCatalog('en', { Abierta: 'Open' });
    const label = msg('Abierta');
    expect(label).toBe('Abierta');
    setLocale('en');
    expect(t(label)).toBe('Open');
  });
});

describe('tn', () => {
  it('picks the form for the count and the language', () => {
    registerCatalog('en', {
      '{count} servicio': '{count} job',
      '{count} servicios': '{count} jobs',
    });
    const label = (n: number) => tn(n, '{count} servicio', '{count} servicios');
    expect(label(1)).toBe('1 servicio');
    expect(label(3)).toBe('3 servicios');
    setLocale('en');
    expect(label(1)).toBe('1 job');
    expect(label(0)).toBe('0 jobs');
  });

  it('treats 0 and 1 as singular in French and Portuguese', () => {
    expect(isSingular(0, 'fr')).toBe(true);
    expect(isSingular(1, 'pt')).toBe(true);
    expect(isSingular(1.5, 'fr')).toBe(true);
    expect(isSingular(2, 'fr')).toBe(false);
    expect(isSingular(0, 'es')).toBe(false);
    expect(isSingular(1, 'en')).toBe(true);
  });
});

describe('resolveLocale', () => {
  it('maps regional tags to a language we have and falls back to English', () => {
    expect(resolveLocale('es-CO')).toBe('es');
    expect(resolveLocale('pt_BR')).toBe('pt');
    expect(resolveLocale('FR')).toBe('fr');
    expect(resolveLocale('de-DE')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale('', 'es')).toBe('es');
  });

  it('gives Intl a tag it understands', () => {
    expect(intlLocale('pt')).toBe('pt-BR');
    expect(intlLocale('es')).toBe('es');
  });
});
