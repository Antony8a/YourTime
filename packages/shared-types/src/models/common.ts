// Common Types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    cursor?: string;
    has_more: boolean;
  };
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export type UUID = string;

export interface Timestamped {
  created_at: string;
  updated_at: string;
}

export interface SoftDeletable {
  deleted_at?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Money {
  amount_cents: number;
  currency: string;
}

export interface Tokens {
  amount: number;
}