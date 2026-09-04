// Messages API Types
export interface ConversationDTO {
  id: string;
  task?: TaskRefDTO;
  other_participant: UserRefDTO;
  last_message?: MessageDTO;
  unread_count: number;
  updated_at: string;
}

export interface TaskRefDTO {
  id: string;
  title: string;
}

export interface UserRefDTO {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export interface MessageDTO {
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

export interface SendMessageRequest {
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}

export interface PaginatedMessagesResponse {
  data: MessageDTO[];
  meta: {
    cursor?: string;
    has_more: boolean;
  };
}