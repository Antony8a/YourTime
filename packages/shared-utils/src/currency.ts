import { intlLocale, msg, t } from './i18n';

/**
 * Money helpers. Amounts are integers in minor units (cents) of an ISO 4217
 * currency. Most currencies have 2 decimals; the ones below do not. Keep
 * SUPPORTED_CURRENCIES in sync with the backend list
 * (apps/backend/internal/domain/common/valueobjects/currency.go).
 */

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'IDR']);

export interface CurrencyInfo {
  code: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'USD', name: msg('Dólar estadounidense') },
  { code: 'EUR', name: msg('Euro') },
  { code: 'GBP', name: msg('Libra esterlina') },
  { code: 'MXN', name: msg('Peso mexicano') },
  { code: 'COP', name: msg('Peso colombiano') },
  { code: 'ARS', name: msg('Peso argentino') },
  { code: 'CLP', name: msg('Peso chileno') },
  { code: 'PEN', name: msg('Sol peruano') },
  { code: 'UYU', name: msg('Peso uruguayo') },
  { code: 'BRL', name: msg('Real brasileño') },
  { code: 'BOB', name: msg('Boliviano') },
  { code: 'PYG', name: msg('Guaraní') },
  { code: 'VES', name: msg('Bolívar venezolano') },
  { code: 'DOP', name: msg('Peso dominicano') },
  { code: 'CRC', name: msg('Colón costarricense') },
  { code: 'GTQ', name: msg('Quetzal') },
  { code: 'HNL', name: msg('Lempira') },
  { code: 'NIO', name: msg('Córdoba') },
  { code: 'PAB', name: msg('Balboa') },
  { code: 'CAD', name: msg('Dólar canadiense') },
  { code: 'AUD', name: msg('Dólar australiano') },
  { code: 'NZD', name: msg('Dólar neozelandés') },
  { code: 'CHF', name: msg('Franco suizo') },
  { code: 'JPY', name: msg('Yen japonés') },
  { code: 'CNY', name: msg('Yuan chino') },
  { code: 'HKD', name: msg('Dólar de Hong Kong') },
  { code: 'TWD', name: msg('Nuevo dólar taiwanés') },
  { code: 'KRW', name: msg('Won surcoreano') },
  { code: 'SGD', name: msg('Dólar de Singapur') },
  { code: 'INR', name: msg('Rupia india') },
  { code: 'IDR', name: msg('Rupia indonesia') },
  { code: 'PHP', name: msg('Peso filipino') },
  { code: 'THB', name: msg('Baht tailandés') },
  { code: 'VND', name: msg('Dong vietnamita') },
  { code: 'MYR', name: msg('Ringgit malayo') },
  { code: 'SEK', name: msg('Corona sueca') },
  { code: 'NOK', name: msg('Corona noruega') },
  { code: 'DKK', name: msg('Corona danesa') },
  { code: 'PLN', name: msg('Esloti polaco') },
  { code: 'CZK', name: msg('Corona checa') },
  { code: 'TRY', name: msg('Lira turca') },
  { code: 'ZAR', name: msg('Rand sudafricano') },
  { code: 'AED', name: msg('Dírham de los EAU') },
  { code: 'SAR', name: msg('Riyal saudí') },
  { code: 'ILS', name: msg('Nuevo séquel') },
  { code: 'EGP', name: msg('Libra egipcia') },
  { code: 'NGN', name: msg('Naira') },
  { code: 'KES', name: msg('Chelín keniano') },
];

/** How many decimals the currency has (its minor-unit exponent). */
export function currencyDecimals(code: string): number {
  return ZERO_DECIMAL.has(code.toUpperCase()) ? 0 : 2;
}

/** Converts a human amount (what a person types) to minor units. */
export function toMinor(amount: number, code: string): number {
  // The epsilon corrects binary float error such as 1.005 * 100 = 100.49999.
  return Math.round(amount * 10 ** currencyDecimals(code) + Number.EPSILON * 1e3);
}

/** Converts minor units to a human amount. */
export function fromMinor(minor: number, code: string): number {
  return minor / 10 ** currencyDecimals(code);
}

/**
 * Parses what a person typed ("1.500,50", "1,500.50", "80000") to a number.
 * Returns null when it is not a usable positive amount.
 */
export function parseAmount(input: string): number | null {
  if (/^\s*-/.test(input)) return null;
  const cleaned = input.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const decimalSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  let normalized: string;

  if (decimalSep === -1) {
    normalized = cleaned;
  } else {
    const digitsAfter = cleaned.length - decimalSep - 1;
    const separatorCount = (cleaned.match(/[.,]/g) ?? []).length;
    // "1.500" with one separator and exactly 3 trailing digits is a thousands
    // separator. Repeated separators ("1.234.567") are thousands too.
    const allThousands = separatorCount > 1 && new Set(cleaned.match(/[.,]/g)).size === 1;
    const isThousands = allThousands || (separatorCount === 1 && digitsAfter === 3);
    normalized = isThousands
      ? cleaned.replace(/[.,]/g, '')
      : cleaned.slice(0, decimalSep).replace(/[.,]/g, '') + '.' + cleaned.slice(decimalSep + 1);
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Formats minor units as money, e.g. formatMoney(8000000, 'COP') gives "$ 80.000". */
export function formatMoney(minor: number, code: string, locale = intlLocale()): string {
  const decimals = currencyDecimals(code);
  const amount = fromMinor(minor, code);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: amount % 1 === 0 ? 0 : decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    // Runtimes without Intl currency support.
    return `${amount.toFixed(amount % 1 === 0 ? 0 : decimals)} ${code}`;
  }
}

export interface BudgetLike {
  type: 'fixed' | 'hourly' | 'negotiable';
  min_minor: number | null;
  max_minor: number | null;
  currency: string;
}

/** "$ 80.000 – $ 150.000", "$ 25.000 / h" or "A convenir". */
export function formatBudget(b: BudgetLike, locale = intlLocale()): string {
  if (b.min_minor == null || b.max_minor == null) return t('A convenir');
  const suffix = b.type === 'hourly' ? ' / h' : '';
  if (b.min_minor === b.max_minor) return formatMoney(b.min_minor, b.currency, locale) + suffix;
  return `${formatMoney(b.min_minor, b.currency, locale)} – ${formatMoney(b.max_minor, b.currency, locale)}${suffix}`;
}

/** 1000 basis points is "10 %": how the commission and discounts are shown. */
export function formatPercent(bps: number, locale = intlLocale()): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(
      bps / 10000
    );
  } catch {
    return `${bps / 100} %`;
  }
}
