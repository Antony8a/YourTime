// Currency Formatting
export function formatCurrency(
  amountCents: number,
  currency = 'USD',
  locale = 'es-AR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatCurrencyCompact(
  amountCents: number,
  currency = 'USD',
  locale = 'es-AR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amountCents / 100);
}

export function formatTokens(tokens: number, locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale).format(tokens);
}

export function formatTokensCompact(tokens: number, locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(tokens);
}

export function parseCurrency(input: string, currency = 'USD'): number | null {
  // Remove currency symbols and spaces
  const cleaned = input.replace(/[^\d.,-]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : Math.round(value * 100);
}