/**
 * API contract shared by every client. Field names are the JSON wire format.
 * Source of truth for behaviour: docs/API.md. Money is always an integer in
 * minor units (cents) of an explicit ISO 4217 currency.
 */

// ---- vocabulary ------------------------------------------------------------

/**
 * open -> assigned -> en_route -> in_progress -> completed, or cancelled.
 * Remote tasks skip en_route. assigned, en_route and in_progress are the
 * "active service" states: a person has at most one as client and one as worker.
 */
export type TaskStatus =
  'open' | 'assigned' | 'en_route' | 'in_progress' | 'completed' | 'cancelled';

/** What a person may do next on a task. The API computes it; clients render from it. */
export type TaskAction =
  'edit' | 'cancel' | 'start_route' | 'start_service' | 'complete' | 'release';
export type BudgetType = 'fixed' | 'hourly' | 'negotiable';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type TaskSort = 'recent' | 'distance';

// ---- common ----------------------------------------------------------------

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  /** An Ionicons glyph name. */
  icon: string;
  /** Hex colour, e.g. #3B82F6. */
  color: string;
}

/** Reviews summary: stars from 1 to 5 and how many people rated. average is 0 when count is 0. */
export interface Rating {
  average: number;
  count: number;
}

/**
 * How a person has behaved as a worker, from the services they finished, to help a
 * poster choose. Remote services, ones without a scheduled time and ones where the
 * worker was chosen too late to make the trip are left out of punctuality.
 */
export interface Reliability {
  completed_services: number;
  /** Median seconds from being chosen to setting out (or starting, if remote). Null with no history. */
  response_seconds: number | null;
  /** On-site scheduled services started on time, out of those that could be judged fairly. */
  on_time_count: number;
  on_time_total: number;
  /** Rounded percentage; null when nothing could be judged. */
  on_time_percent: number | null;
}

/** A person as seen by someone else. Email/phone only appear when allowed. */
export interface Party {
  id: string;
  full_name: string;
  avatar_url: string | null;
  rating: Rating;
  /** Present on applicants, where the poster is choosing between them. */
  reliability?: Reliability;
  email?: string;
  phone?: string | null;
}

export interface Page<T> {
  data: T[];
  meta: { has_more: boolean; limit: number; offset: number };
}

export interface Envelope<T> {
  data: T;
}

/** RFC 7807 problem details returned for every error. */
export interface ApiProblem {
  type: string;
  /** Stable machine-readable error code (see docs/API.md). Clients translate it. */
  code?: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: { field: string; code: string; message: string }[];
}

// ---- users & auth ----------------------------------------------------------

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  /** ISO 4217 account currency. Amounts the person sees use it as default. */
  currency: string;
  /** The app language the person chose ("es", "en", "pt", "fr"); null follows the device. */
  language: string | null;
  location: Location | null;
  /** Preferred browsing radius in km; null means no limit. Never blocks applying. */
  search_radius_km: number | null;
  rating: Rating;
  created_at: string;
}

export interface Session {
  user: User;
  access_token: string;
  refresh_token: string;
  /** Access token lifetime in seconds. */
  expires_in: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  currency?: string;
  /** A language or device locale ("es", "pt-BR"); omit to follow the device. */
  language?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateMeRequest {
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  phone?: string;
  currency?: string;
  /** A language to choose, or "" to go back to following the device. */
  language?: string;
  location?: { latitude: number; longitude: number; city?: string };
  /** Number to set, null to clear (no limit), omit to leave unchanged. */
  search_radius_km?: number | null;
}

// ---- tasks -----------------------------------------------------------------

export interface Budget {
  type: BudgetType;
  min_minor: number | null;
  max_minor: number | null;
  currency: string;
}

export interface WorkerLocation {
  latitude: number;
  longitude: number;
  updated_at: string;
}

/** The service a person currently has as client and as worker (each null when none). */
export interface ActiveServices {
  as_client: Task | null;
  as_worker: Task | null;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  price_minor: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: Category;
  budget: Budget;
  is_remote: boolean;
  location: Location | null;
  scheduled_at: string | null;
  status: TaskStatus;
  poster: Party;
  /** Visible to the poster only. */
  assigned_applicant: Party | null;
  applications_count: number;
  /** Km from the viewer's origin; null when unknown or remote. */
  distance_km: number | null;
  /**
   * Hint relative to the viewer's preferred radius. null = nothing to compare.
   * It informs the decision and never prevents applying.
   */
  within_preferred_radius: boolean | null;
  is_owner: boolean;
  /** True for the person chosen to do the task. */
  is_worker: boolean;
  actions: TaskAction[];
  en_route_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  /** Price of the chosen application, in minor units of the task's currency. */
  agreed_price_minor: number | null;
  /** Where the worker last reported being. Only the two participants get it, only while active. */
  worker_location: WorkerLocation | null;
  can_apply: boolean;
  my_application: MyApplication | null;
  /** True for the poster or chosen applicant of a completed task who has not reviewed yet. */
  can_review: boolean;
  /** The review the viewer wrote about the other person. */
  my_review: Review | null;
  /** The review the other person wrote about the viewer. */
  review_for_me: Review | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  category_id: string;
  title: string;
  description: string;
  budget: {
    type: BudgetType;
    min_minor?: number;
    max_minor?: number;
    /** Defaults to the poster's account currency. */
    currency?: string;
  };
  is_remote?: boolean;
  /** Required unless is_remote; defaults to the poster's saved location. */
  location?: Location;
  scheduled_at?: string;
}

export interface TaskListParams {
  q?: string;
  category_id?: string;
  /** Override the origin used for distances (defaults to saved location). */
  lat?: number;
  lng?: number;
  /** Hide on-site tasks farther than this. Remote tasks always pass. */
  max_distance_km?: number;
  /** Apply the viewer's saved radius when max_distance_km is not given. */
  preferred_radius?: boolean;
  sort?: TaskSort;
  limit?: number;
  offset?: number;
}

// ---- applications ----------------------------------------------------------

export interface TaskBrief {
  id: string;
  title: string;
  status: TaskStatus;
  currency: string;
  city?: string;
  is_remote: boolean;
  poster_name: string;
}

export interface Application {
  id: string;
  task_id: string;
  /** Proposed price in minor units of `currency` (the task's currency). */
  price_minor: number;
  currency: string;
  message: string;
  status: ApplicationStatus;
  applicant: Party;
  /** The applicant is doing another service now and cannot be chosen. */
  applicant_busy: boolean;
  task: TaskBrief;
  created_at: string;
}

export interface ApplyRequest {
  price_minor: number;
  message?: string;
}

// ---- reviews ---------------------------------------------------------------

export interface Review {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  comment: string;
  /** The reviewed person's single answer. */
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  /** Only present when listing a person's reviews. */
  reviewer?: Party;
  task_title?: string;
}

export interface ReviewInput {
  rating: number;
  comment?: string;
}

/** What anyone can see about a person. No contact details. */
export interface PublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  rating: Rating;
  member_since: string;
  reliability: Reliability;
}

// ---- balance ---------------------------------------------------------------

/** What was earned or spent in one currency. Currencies are never mixed or converted. */
export interface BalanceTotal {
  currency: string;
  total_minor: number;
  count: number;
}

/** One finished service, from the point of view of the person asking. */
export interface BalanceEntry {
  task_id: string;
  title: string;
  category: { name: string; icon: string; color: string };
  /** The other person: the client when you worked, the worker when you paid. */
  counterpart: { id: string; full_name: string; avatar_url: string | null };
  currency: string;
  amount_minor: number;
  completed_at: string;
  /** The amount in the person's currency at the rate of the day it was finished; null when it already is in that currency. */
  converted_minor: number | null;
}

export interface BalanceSide {
  totals: BalanceTotal[];
  entries: BalanceEntry[];
  /** True when the period holds more services than `entries` lists. */
  has_more: boolean;
  /** Every currency added up in the person's currency; null when none could be converted. */
  converted: BalanceConverted | null;
}

export interface BalanceConverted {
  currency: string;
  total_minor: number;
  /** Some service had no rate for its own day, so the closest day was used. */
  approximate: boolean;
  /** Some amount could not be converted and is left out. */
  partial: boolean;
}

export interface Balance {
  /** The account currency, which conversions are into. */
  currency: string;
  from: string | null;
  to: string | null;
  /** Money from services the person did. */
  earned: BalanceSide;
  /** Money paid for services the person requested. */
  spent: BalanceSide;
}

// ---- wallet ----------------------------------------------------------------

/**
 * The prepaid credit people spend to take on work. Its currency is the account's at
 * the moment it is first credited, and from then on neither can change.
 */
export interface Wallet {
  currency: string;
  balance_minor: number;
  /** True once the wallet has been credited; the currency is then fixed. */
  established: boolean;
  /** The platform commission, in basis points of the agreed price (1000 = 10 %). */
  fee_bps: number;
  /** The share of the commission waived for this person right now, in basis points. */
  discount_bps: number;
  test_topups_enabled: boolean;
  /** The largest test top-up, in the wallet currency. */
  test_topup_max_minor: number;
  /** Top-up amounts offered, in the wallet currency. */
  suggested_topups_minor: number[];
  is_admin: boolean;
}

export type WalletTransactionKind =
  | 'topup_test'
  | 'topup_manual'
  | 'topup_bonus'
  | 'promo_credit'
  | 'signup_credit'
  | 'fee'
  | 'fee_refund';

export interface WalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  /** Signed: credits are positive, the commission negative. */
  amount_minor: number;
  balance_after_minor: number;
  currency: string;
  task_id: string | null;
  task_title: string | null;
  note: string | null;
  created_at: string;
}

/** What taking a task would cost in commission, and whether the wallet covers it. */
export interface FeeQuote {
  fee_minor: number;
  currency: string;
  balance_minor: number;
  enough: boolean;
  established: boolean;
  fee_bps: number;
  discount_bps: number;
}

export interface TopupResult {
  currency: string;
  balance_minor: number;
  bonus_minor: number;
}

export interface RedeemResult {
  name: string;
  kind: PromotionKind;
  credited_minor: number;
  currency: string;
  balance_minor: number;
  discount_bps: number;
}

export type PromotionKind = 'topup_bonus' | 'fee_discount' | 'credit_grant';

// ---- administrator ---------------------------------------------------------

export interface PlatformSettings {
  fee_bps: number;
  test_topups_enabled: boolean;
  /** Amounts below are in USD minor units, converted to each person's currency. */
  test_topup_max_usd_minor: number;
  signup_credit_usd_minor: number;
  updated_at: string;
}

export interface FeeTotals {
  currency: string;
  /** Commissions charged minus those refunded. */
  net_fees_minor: number;
  /** Credit still sitting in wallets. */
  outstanding_minor: number;
  wallets: number;
}

export interface AdminOverview {
  settings: PlatformSettings;
  totals: FeeTotals[];
}

export interface Promotion {
  id: string;
  name: string;
  code: string | null;
  kind: PromotionKind;
  value_bps: number | null;
  amount_usd_minor: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  max_redemptions: number | null;
  redemptions_count: number;
  created_at: string;
}

export interface NewPromotion {
  name: string;
  code?: string;
  kind: PromotionKind;
  value_bps?: number;
  amount_usd_minor?: number;
  starts_at?: string;
  ends_at?: string;
  max_redemptions?: number;
}
