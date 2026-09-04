// Currency Conversion
export interface ExchangeRate {
  buyRate: number;   // tokens per $1 when buying
  sellRate: number;  // tokens per $1 when selling
}

export function tokensToUSD(tokens: number, sellRate: number): number {
  // sellRate: tokens per $1 (e.g., 90 tokens = $1)
  return tokens / sellRate;
}

export function usdToTokens(usd: number, buyRate: number): number {
  // buyRate: tokens per $1 (e.g., 100 tokens = $1)
  return Math.round(usd * buyRate);
}

export function calculatePlatformFee(amount: number, feePercent: number): number {
  return Math.round(amount * feePercent / 100);
}

export function calculateNetAmount(
  grossTokens: number,
  platformFeePercent: number,
  sellRate: number
): { grossUsd: number; platformFeeUsd: number; netUsd: number } {
  const grossUsd = tokensToUSD(grossTokens, sellRate);
  const platformFeeUsd = calculatePlatformFee(grossUsd, platformFeePercent);
  const netUsd = grossUsd - platformFeeUsd;
  return { grossUsd, platformFeeUsd, netUsd };
}