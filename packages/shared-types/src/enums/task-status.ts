// Task Enums
export enum TaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export enum TaskUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum BudgetType {
  FIXED = 'fixed',
  HOURLY = 'hourly',
  NEGOTIABLE = 'negotiable',
}