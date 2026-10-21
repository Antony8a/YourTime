import { currencyDecimals, type BudgetLike } from './currency';

/**
 * Today's exchange rates, as served by the API: how many units of each currency
 * equal one unit of `base`. Conversion is only ever informative: a price stays in
 * the currency it was agreed in, and this just helps people compare.
 */
export interface Rates {
  /** The day the rates are for, "YYYY-MM-DD". */
  date: string;
  base: string;
  rates: Record<string, number>;
  /** True when today's rates could not be fetched and older ones are shown. */
  stale?: boolean;
}

/**
 * Converts minor units of `from` into minor units of `to`, or null when there is
 * no rate for either currency. Mirrors the backend (rates.Snapshot.Convert), which
 * the balance uses, so a price reads the same on a card and in the balance.
 */
export function convertMinor(
  minor: number,
  from: string,
  to: string,
  table: Rates | null | undefined
): number | null {
  if (from === to) return minor;
  if (!table) return null;
  const rateFrom = table.rates[from];
  const rateTo = table.rates[to];
  if (!rateFrom || !rateTo || rateFrom <= 0 || rateTo <= 0) return null;
  const major = minor / 10 ** currencyDecimals(from);
  return Math.round((major / rateFrom) * rateTo * 10 ** currencyDecimals(to));
}

/** The same budget expressed in `to`, or null when it cannot be converted (or has no amount). */
export function convertBudget(
  budget: BudgetLike,
  to: string,
  table: Rates | null | undefined
): BudgetLike | null {
  if (budget.currency === to || budget.min_minor == null || budget.max_minor == null) return null;
  const min = convertMinor(budget.min_minor, budget.currency, to, table);
  const max = convertMinor(budget.max_minor, budget.currency, to, table);
  if (min == null || max == null) return null;
  return { ...budget, min_minor: min, max_minor: max, currency: to };
}

/**
 * An approximation does not need cents: from 100 units up it is rounded to whole
 * units ("≈ 63.075 COP", not "≈ 63.075,47 COP"); smaller amounts keep their decimals
 * ("≈ 7,93 US$"). For display only: stored and returned amounts stay exact.
 */
export function roundForDisplay(minor: number, code: string): number {
  const unit = 10 ** currencyDecimals(code);
  return Math.abs(minor) >= 100 * unit ? Math.round(minor / unit) * unit : minor;
}
