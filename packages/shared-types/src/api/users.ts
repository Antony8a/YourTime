// Users API Types
export interface UserProfileDTO {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  location_city?: string;
  rating_as_client: number;
  reviews_as_client: number;
  jobs_posted: number;
  jobs_completed_as_client: number;
  rating_as_worker: number;
  reviews_as_worker: number;
  jobs_completed_as_worker: number;
  skills: string[];
  verified_skills: string[];
  hourly_rate_tokens?: number;
  availability: Record<string, { start: string; end: string }>;
  portfolio_images: string[];
  created_at: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  location_city?: string;
  location_lat?: number;
  location_lng?: number;
}

export interface ReviewDTO {
  id: string;
  task_id: string;
  task_title: string;
  reviewer: UserRefDTO;
  rating: number;
  comment?: string;
  quality_rating?: number;
  communication_rating?: number;
  punctuality_rating?: number;
  created_at: string;
}

export interface UserRefDTO {
  id: string;
  full_name: string;
  avatar_url?: string;
}