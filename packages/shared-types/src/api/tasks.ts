// Tasks API Types
import { TaskStatus, TaskUrgency, BudgetType } from '../enums';

export interface CreateTaskRequest {
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
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  budget_min_tokens?: number;
  budget_max_tokens?: number;
  preferred_date?: string;
}

export interface TaskFilters {
  status?: TaskStatus;
  category_id?: string;
  skill_id?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  budget_min?: number;
  budget_max?: number;
  date_from?: string;
  date_to?: string;
  urgency?: TaskUrgency;
  sort?: 'created_desc' | 'budget_asc' | 'distance';
  limit?: number;
  cursor?: string;
}

export interface TaskListItemDTO {
  id: string;
  title: string;
  category: CategoryRefDTO;
  skill?: SkillRefDTO;
  budget_min_tokens: number;
  budget_max_tokens: number;
  budget_type: BudgetType;
  location_city: string;
  distance_km?: number;
  urgency: TaskUrgency;
  status: TaskStatus;
  client: UserRefDTO;
  applications_count: number;
  preferred_date?: string;
  created_at: string;
}

export interface TaskDetailDTO extends TaskListItemDTO {
  description: string;
  estimated_hours?: number;
  preferred_time_start?: string;
  preferred_time_end?: string;
  location: LocationDTO;
  client: UserRefDTO;
  assigned_worker?: UserRefDTO;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  views_count: number;
  can_apply: boolean;
  user_application?: TaskApplicationDTO;
  updated_at: string;
}

export interface CategoryRefDTO {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface SkillRefDTO {
  id: string;
  name: string;
}

export interface LocationDTO {
  lat: number;
  lng: number;
  address?: string;
  city: string;
}

export interface UserRefDTO {
  id: string;
  full_name: string;
  avatar_url?: string;
  rating_as_client?: number;
}

export interface CreateApplicationRequest {
  proposed_tokens: number;
  proposed_hours?: number;
  message: string;
}

export interface TaskApplicationDTO {
  id: string;
  task_id: string;
  worker_id: string;
  proposed_tokens: number;
  proposed_hours?: number;
  message: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  worker?: UserRefDTO & {
    rating_as_worker: number;
    reviews_as_worker: number;
    skills: string[];
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    cursor?: string;
    has_more: boolean;
  };
}