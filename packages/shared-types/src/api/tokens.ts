// Tokens API Types
import { TransactionType } from '../enums';

export interface TokenBalanceDTO {
  available_tokens: number;
  pending_tokens: number;
  lifetime_earned: number;
  lifetime_spent: number;
  lifetime_withdrawn: number;
}

export interface TokenTransactionDTO {
  id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  description: string;
  related_task?: TaskRefDTO;
  related_application?: ApplicationRefDTO;
  related_withdrawal?: WithdrawalRefDTO;
  related_purchase?: PurchaseRefDTO;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TaskRefDTO {
  id: string;
  title: string;
}

export interface ApplicationRefDTO {
  id: string;
}

export interface WithdrawalRefDTO {
  id: string;
}

export interface PurchaseRefDTO {
  id: string;
}

export interface TokenPackageDTO {
  tokens: number;
  price_cents: number;
  bonus_tokens: number;
  price_usd: number;
  tokens_per_usd: number;
}

export interface PurchaseIntentRequest {
  package_tokens: number;
  payment_provider: 'stripe' | 'mercadopago';
}

export interface PurchaseIntentResponse {
  purchase_id: string;
  client_token: string;
  provider: string;
  amount_cents: number;
  tokens: number;
}

export interface WithdrawalRequest {
  tokens_amount: number;
  payout_method: 'bank_transfer' | 'paypal' | 'mercadopago';
  payout_details: Record<string, unknown>;
}

export interface WithdrawalDTO {
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

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ExchangeRateDTO {
  buy_rate: number;
  sell_rate: number;
  platform_fee_task_percent: number;
  platform_fee_withdrawal_percent: number;
  min_withdrawal_tokens: number;
}