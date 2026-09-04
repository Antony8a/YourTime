// Token Models
import { TransactionType, PurchaseStatus, WithdrawalStatus } from '../enums';

export interface TokenPackage {
  tokens: number;
  price_cents: number;
  bonus_tokens: number;
  price_usd: number;
  tokens_per_usd: number;
}

export interface ExchangeRateConfig {
  buy_rate: number;
  sell_rate: number;
  platform_fee_task_percent: number;
  platform_fee_withdrawal_percent: number;
  min_withdrawal_tokens: number;
  max_withdrawal_tokens: number;
  token_packages: TokenPackage[];
}

export interface PurchaseIntent {
  purchase_id: string;
  client_token: string;
  provider: string;
  amount_cents: number;
  tokens: number;
}

export interface WithdrawalRequest {
  tokens_amount: number;
  payout_method: PayoutMethod;
  payout_details: Record<string, unknown>;
}

export type PayoutMethod = 'bank_transfer' | 'paypal' | 'mercadopago';

export interface WithdrawalResponse {
  id: string;
  tokens_amount: number;
  currency: string;
  amount_cents: number;
  gross_amount_cents: number;
  platform_fee_cents: number;
  payment_processor_fee_cents: number;
  exchange_rate: number;
  payout_method: string;
  status: WithdrawalStatus;
  processed_at?: string;
  failure_reason?: string;
  created_at: string;
}

export interface LedgerEntry {
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  related_task_id?: string;
  related_application_id?: string;
  related_withdrawal_id?: string;
  related_purchase_id?: string;
  description: string;
  metadata: Record<string, unknown>;
}