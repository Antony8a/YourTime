// Notifications API Types
export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body?: string;
  data: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface NotificationsListResponse {
  data: NotificationDTO[];
  meta: {
    cursor?: string;
    has_more: boolean;
  };
}