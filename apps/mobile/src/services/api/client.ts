import { useAuthStore } from '../stores/authStore';

const API_URL = 'http://localhost:8080/api/v1';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { accessToken, refreshAccessToken } = useAuthStore.getState();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    };

    let response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && endpoint !== '/auth/refresh') {
      await refreshAccessToken();
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
      throw new Error(error.detail || `Error ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // Auth
  login = (data: { email: string; password: string; remember_me?: boolean }) =>
    this.request('/auth/login', { method: 'POST', body: JSON.stringify(data) });

  register = (data: { email: string; password: string; full_name: string; phone?: string }) =>
    this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });

  refreshToken = (refresh_token: string) =>
    this.request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }) });

  forgotPassword = (email: string) =>
    this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

  resetPassword = (token: string, password: string) =>
    this.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });

  getMe = () => this.request('/auth/me');

  // Tasks
  listTasks = (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return this.request(`/tasks?${searchParams}`);
  };

  getTask = (id: string) => this.request(`/tasks/${id}`);

  createTask = (data: any) => this.request('/tasks', { method: 'POST', body: JSON.stringify(data) });

  updateTask = (id: string, data: any) => this.request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

  cancelTask = (id: string, reason: string) => this.request(`/tasks/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });

  // Applications
  applyToTask = (taskId: string, data: any) => this.request(`/tasks/${taskId}/applications`, { method: 'POST', body: JSON.stringify(data) });

  getApplications = (taskId: string) => this.request(`/tasks/${taskId}/applications`);

  acceptApplication = (id: string) => this.request(`/applications/${id}/accept`, { method: 'POST' });

  rejectApplication = (id: string) => this.request(`/applications/${id}/reject`, { method: 'POST' });

  // Tokens
  getBalance = () => this.request('/tokens/balance');

  getPackages = () => this.request('/tokens/packages');

  purchaseTokens = (data: { package_tokens: number; payment_provider: string }) =>
    this.request('/tokens/purchase', { method: 'POST', body: JSON.stringify(data) });

  requestWithdrawal = (data: any) => this.request('/tokens/withdraw', { method: 'POST', body: JSON.stringify(data) });

  getWithdrawals = () => this.request('/tokens/withdrawals');

  // Messages
  listConversations = () => this.request('/conversations');

  listMessages = (conversationId: string, params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return this.request(`/conversations/${conversationId}/messages?${searchParams}`);
  };

  sendMessage = (conversationId: string, data: { content: string; type?: string }) =>
    this.request(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(data) });

  // Notifications
  listNotifications = (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return this.request(`/notifications?${searchParams}`);
  };

  markRead = (id: string) => this.request(`/notifications/${id}/read`, { method: 'PATCH' });

  readAll = () => this.request('/notifications/read-all', { method: 'POST' });
}

export const api = new ApiClient();