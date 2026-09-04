// Token-specific utilities
import { ExchangeRate, tokensToUSD, usdToTokens, calculatePlatformFee } from './convert';

export interface TokenPackage {
  tokens: number;
  price_cents: number;
  bonus_tokens: number;
  price_usd: number;
  tokens_per_usd: number;
}

export function calculatePackageValue(pkg: TokenPackage, exchangeRate: ExchangeRate): {
  effective_rate: number;
  savings_percent: number;
} {
  const totalTokens = pkg.tokens + pkg.bonus_tokens;
  const effectiveRate = totalTokens / pkg.price_usd;
  const baseRate = exchangeRate.buyRate;
  const savingsPercent = ((effectiveRate - baseRate) / baseRate) * 100;
  return { effective_rate: effectiveRate, savings_percent: savingsPercent };
}

export function getBestPackage(packages: TokenPackage[], exchangeRate: ExchangeRate): TokenPackage {
  return packages.reduce((best, current) => {
    const bestVal = calculatePackageValue(best, exchangeRate);
    const currentVal = calculatePackageValue(current, exchangeRate);
    return currentVal.savings_percent > bestVal.savings_percent ? current : best;
  });
}

export function calculateWithdrawalNet(
  tokensAmount: number,
  exchangeRate: ExchangeRate,
  platformFeePercent: number,
  processorFeePercent: number = 0,
  processorFeeFixed: number = 0
): {
  grossUsd: number;
  platformFeeUsd: number;
  processorFeeUsd: number;
  netUsd: number;
  netCents: number;
} {
  const grossUsd = tokensToUSD(tokensAmount, exchangeRate.sellRate);
  const platformFeeUsd = calculatePlatformFee(grossUsd, platformFeePercent);
  const processorFeeUsd = calculatePlatformFee(grossUsd, processorFeePercent) + processorFeeFixed / 100;
  const netUsd = grossUsd - platformFeeUsd - processorFeeUsd;
  return {
    grossUsd,
    platformFeeUsd,
    processorFeeUsd,
    netUsd,
    netCents: Math.round(netUsd * 100),
  };
}