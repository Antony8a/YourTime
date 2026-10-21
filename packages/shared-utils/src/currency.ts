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
  { code: 'USD', name: 'Dólar estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Libra esterlina' },
  { code: 'MXN', name: 'Peso mexicano' },
  { code: 'COP', name: 'Peso colombiano' },
  { code: 'ARS', name: 'Peso argentino' },
  { code: 'CLP', name: 'Peso chileno' },
  { code: 'PEN', name: 'Sol peruano' },
  { code: 'UYU', name: 'Peso uruguayo' },
  { code: 'BRL', name: 'Real brasileño' },
  { code: 'BOB', name: 'Boliviano' },
  { code: 'PYG', name: 'Guaraní' },
  { code: 'VES', name: 'Bolívar venezolano' },
  { code: 'DOP', name: 'Peso dominicano' },
  { code: 'CRC', name: 'Colón costarricense' },
  { code: 'GTQ', name: 'Quetzal' },
  { code: 'HNL', name: 'Lempira' },
  { code: 'NIO', name: 'Córdoba' },
  { code: 'PAB', name: 'Balboa' },
  { code: 'CAD', name: 'Dólar canadiense' },
  { code: 'AUD', name: 'Dólar australiano' },
  { code: 'NZD', name: 'Dólar neozelandés' },
  { code: 'CHF', name: 'Franco suizo' },
  { code: 'JPY', name: 'Yen japonés' },
  { code: 'CNY', name: 'Yuan chino' },
  { code: 'HKD', name: 'Dólar de Hong Kong' },
  { code: 'TWD', name: 'Nuevo dólar taiwanés' },
  { code: 'KRW', name: 'Won surcoreano' },
  { code: 'SGD', name: 'Dólar de Singapur' },
  { code: 'INR', name: 'Rupia india' },
  { code: 'IDR', name: 'Rupia indonesia' },
  { code: 'PHP', name: 'Peso filipino' },
  { code: 'THB', name: 'Baht tailandés' },
  { code: 'VND', name: 'Dong vietnamita' },
  { code: 'MYR', name: 'Ringgit malayo' },
  { code: 'SEK', name: 'Corona sueca' },
  { code: 'NOK', name: 'Corona noruega' },
  { code: 'DKK', name: 'Corona danesa' },
  { code: 'PLN', name: 'Esloti polaco' },
  { code: 'CZK', name: 'Corona checa' },
  { code: 'TRY', name: 'Lira turca' },
  { code: 'ZAR', name: 'Rand sudafricano' },
  { code: 'AED', name: 'Dírham de los EAU' },
  { code: 'SAR', name: 'Riyal saudí' },
  { code: 'ILS', name: 'Nuevo séquel' },
  { code: 'EGP', name: 'Libra egipcia' },
  { code: 'NGN', name: 'Naira' },
  { code: 'KES', name: 'Chelín keniano' },
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
export function formatMoney(minor: number, code: string, locale = 'es'): string {
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
export function formatBudget(b: BudgetLike, locale = 'es'): string {
  if (b.min_minor == null || b.max_minor == null) return 'A convenir';
  const suffix = b.type === 'hourly' ? ' / h' : '';
  if (b.min_minor === b.max_minor) return formatMoney(b.min_minor, b.currency, locale) + suffix;
  return `${formatMoney(b.min_minor, b.currency, locale)} – ${formatMoney(b.max_minor, b.currency, locale)}${suffix}`;
}
