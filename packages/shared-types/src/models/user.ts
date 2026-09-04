// Core Models
import { TaskStatus, TaskUrgency, BudgetType, ApplicationStatus, TransactionType } from '../enums';

export interface User {
  id: string;
  email: string;
  phone?: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  location_lat?: number;
  location_lng?: number;
  location_city?: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  phone_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export type UserRole = 'user' | 'admin' | 'moderator';
export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface UserProfile {
  user_id: string;
  rating_as_client: number;
  reviews_as_client: number;
  jobs_posted: number;
  jobs_completed_as_client: number;
  rating_as_worker: number;
  reviews_as_worker: number;
  jobs_completed_as_worker: number;
  skills: string[];
  hourly_rate_tokens?: number;
  availability: Record<string, { start: string; end: string }>;
  verified_skills: string[];
  portfolio_images: string[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Skill {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string;
  category_id: string;
  skill_id?: string;
  title: string;
  description: string;
  location_lat: number;
  location_lng: number;
  location_address?: string;
  location_city: string;
  budget_min_tokens: number;
  budget_max_tokens: number;
  budget_type: BudgetType;
  estimated_hours?: number;
  preferred_date?: string;
  preferred_time_start?: string;
  preferred_time_end?: string;
  urgency: TaskUrgency;
  status: TaskStatus;
  assigned_worker_id?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface TaskApplication {
  id: string;
  task_id: string;
  worker_id: string;
  proposed_tokens: number;
  proposed_hours?: number;
  message: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface TokenBalance {
  user_id: string;
  available_tokens: number;
  pending_tokens: number;
  lifetime_earned: number;
  lifetime_spent: number;
  lifetime_withdrawn: number;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
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
  created_at: string;
}

export interface TokenPurchase {
  id: string;
  user_id: string;
  tokens_amount: number;
  currency: string;
  amount_cents: number;
  exchange_rate: number;
  payment_provider: string;
  payment_intent_id?: string;
  status: PurchaseStatus;
  completed_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type PurchaseStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface TokenWithdrawal {
  id: string;
  worker_id: string;
  tokens_amount: number;
  currency: string;
  amount_cents: number;
  gross_amount_cents: number;
  platform_fee_cents: number;
  payment_processor_fee_cents: number;
  exchange_rate: number;
  payout_method: string;
  payout_details: Record<string, unknown>;
  status: WithdrawalStatus;
  processed_at?: string;
  failure_reason?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Review {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  quality_rating?: number;
  communication_rating?: number;
  punctuality_rating?: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  last_read_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  metadata: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'offer';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface PlatformConfig {
  key: string;
  value: Record<string, unknown>;
  description?: string;
  updated_at: string;
}