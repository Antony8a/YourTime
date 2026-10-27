import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  ActiveServices,
  AdminOverview,
  Application,
  ApplyRequest,
  Balance,
  Category,
  FeeQuote,
  LoginRequest,
  NewPromotion,
  Page,
  PlatformSettings,
  Promotion,
  PublicProfile,
  RedeemResult,
  RegisterRequest,
  Review,
  ReviewInput,
  Session,
  Task,
  TaskInput,
  TaskListParams,
  TaskStatus,
  TopupResult,
  UpdateMeRequest,
  User,
  Wallet,
  WalletTransaction,
} from '@yourtime/shared-types';
import { rangeBounds, type DateRange, type Rates } from '@yourtime/shared-utils';
import { useAuth } from '@/store/auth';
import { api } from './client';

const PAGE_SIZE = 15;
/** How often an open task someone is waiting on re-checks the server. */
const OPEN_TASK_POLL_MS = 10_000;

// ---- keys ------------------------------------------------------------------

export const keys = {
  categories: ['categories'] as const,
  feed: (params: TaskListParams) => ['tasks', 'feed', params] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,
  posted: (statuses: TaskStatus[]) => ['tasks', 'posted', statuses] as const,
  myApplications: ['applications', 'mine'] as const,
  taskApplications: (taskId: string) => ['applications', 'task', taskId] as const,
  profile: (id: string) => ['profile', id] as const,
  active: ['active'] as const,
  userReviews: (id: string) => ['reviews', id] as const,
  balance: (range: DateRange) => ['balance', range.from, range.to] as const,
  rates: ['rates'] as const,
  wallet: ['wallet'] as const,
  walletTransactions: ['wallet', 'transactions'] as const,
  feeQuote: (taskId: string, price: number) => ['wallet', 'quote', taskId, price] as const,
  admin: ['admin'] as const,
};

/** Anything that changes tasks or applications refreshes every list that shows them. */
function invalidateTaskData(qc: QueryClient, taskId?: string) {
  void qc.invalidateQueries({ queryKey: ['tasks'] });
  void qc.invalidateQueries({ queryKey: ['applications'] });
  void qc.invalidateQueries({ queryKey: keys.active });
  // Ratings travel with people, so a review changes profiles and review lists too.
  void qc.invalidateQueries({ queryKey: ['profile'] });
  void qc.invalidateQueries({ queryKey: ['reviews'] });
  // Finishing a service moves money between the two people.
  void qc.invalidateQueries({ queryKey: ['balance'] });
  // Being chosen charges the commission, and a service that falls through gives it back.
  void qc.invalidateQueries({ queryKey: keys.wallet });
  if (taskId) void qc.invalidateQueries({ queryKey: keys.task(taskId) });
}

// ---- auth & profile --------------------------------------------------------

export function useLogin() {
  const applySession = useAuth((s) => s.applySession);
  return useMutation({
    mutationFn: (body: LoginRequest) => api.post<Session>('/auth/login', body, true),
    onSuccess: applySession,
  });
}

export function useRegister() {
  const applySession = useAuth((s) => s.applySession);
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.post<Session>('/auth/register', body, true),
    onSuccess: applySession,
  });
}

export function useUpdateMe() {
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeRequest) => api.patch<User>('/me', body),
    onSuccess: (user) => {
      setUser(user);
      // Distances and "within radius" hints depend on the saved location/radius.
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ---- browsing --------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.get<Category[]>('/categories'),
    staleTime: Infinity,
  });
}

export function useFeed(params: TaskListParams) {
  return useInfiniteQuery({
    queryKey: keys.feed(params),
    initialPageParam: 0,
    // Keep showing the previous results while a new filter loads, no flicker.
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      api.page<Task>('/tasks', { ...params, limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.offset + PAGE_SIZE : undefined),
  });
}

/**
 * One task. While a service is live, `pollMs` refreshes it so the poster sees the
 * worker move and both sides see status changes without reloading.
 */
export function useTask(id: string, pollMs?: number) {
  return useQuery({
    queryKey: keys.task(id),
    queryFn: () => api.get<Task>(`/tasks/${id}`),
    refetchInterval: (q) => {
      if (pollMs) return pollMs;
      // An open task someone is waiting on: the poster for offers, an applicant to
      // hear back. Without push notifications this is how they find out.
      const t = q.state.data;
      const waiting =
        !!t && t.status === 'open' && (t.is_owner || t.my_application?.status === 'pending');
      return waiting ? OPEN_TASK_POLL_MS : false;
    },
  });
}

/** The service the person has as client and as worker; drives the banner. */
export function useActiveServices() {
  return useQuery({
    queryKey: keys.active,
    queryFn: () => api.get<ActiveServices>('/me/active'),
    // Stay fresh while there is something live; otherwise only on focus/mutation.
    refetchInterval: (q) => (q.state.data?.as_client || q.state.data?.as_worker ? 15_000 : false),
  });
}

export function usePostedTasks(statuses: TaskStatus[]) {
  return useInfiniteQuery({
    queryKey: keys.posted(statuses),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.page<Task>('/me/tasks', {
        status: statuses.join(','),
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.offset + PAGE_SIZE : undefined),
  });
}

export function useMyApplications() {
  return useInfiniteQuery({
    queryKey: keys.myApplications,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.page<Application>('/me/applications', { limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.offset + PAGE_SIZE : undefined),
  });
}

export function useTaskApplications(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.taskApplications(taskId),
    queryFn: () => api.get<Application[]>(`/tasks/${taskId}/applications`),
    enabled,
  });
}

/** Flattens infinite-query pages into one list. */
export function flatten<T>(pages: Page<T>[] | undefined): T[] {
  return pages?.flatMap((p) => p.data) ?? [];
}

// ---- publishing & managing -------------------------------------------------

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => api.post<Task>('/tasks', body),
    onSuccess: (task) => invalidateTaskData(qc, task.id),
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => api.put<Task>(`/tasks/${id}`, body),
    onSuccess: () => invalidateTaskData(qc, id),
  });
}

function useTaskAction(id: string, action: 'cancel' | 'complete') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Task>(`/tasks/${id}/${action}`),
    onSuccess: () => invalidateTaskData(qc, id),
  });
}

export const useCancelTask = (id: string) => useTaskAction(id, 'cancel');
export const useCompleteTask = (id: string) => useTaskAction(id, 'complete');

// ---- applications ----------------------------------------------------------

export function useApply(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyRequest) => api.post<unknown>(`/tasks/${taskId}/applications`, body),
    onSuccess: () => invalidateTaskData(qc, taskId),
  });
}

export function useApplicationAction(taskId: string, action: 'accept' | 'reject' | 'withdraw') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) =>
      api.post<Application>(`/applications/${applicationId}/${action}`),
    onSuccess: () => invalidateTaskData(qc, taskId),
  });
}

// ---- reviews ---------------------------------------------------------------

export function useProfile(id: string) {
  return useQuery({
    queryKey: keys.profile(id),
    queryFn: () => api.get<PublicProfile>(`/users/${id}`),
  });
}

export function useUserReviews(id: string) {
  return useInfiniteQuery({
    queryKey: keys.userReviews(id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.page<Review>(`/users/${id}/reviews`, { limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.offset + PAGE_SIZE : undefined),
  });
}

export function useCreateReview(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviewInput) => api.post<Review>(`/tasks/${taskId}/reviews`, body),
    onSuccess: () => invalidateTaskData(qc, taskId),
  });
}

export function useReplyReview(taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: string; text: string }) =>
      api.post<Review>(`/reviews/${reviewId}/reply`, { text }),
    onSuccess: () => invalidateTaskData(qc, taskId),
  });
}

// ---- the live service --------------------------------------------------------

/** The worker leaving. Needs their current position. */
export function useStartRoute(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (position: { latitude: number; longitude: number; eta_seconds?: number }) =>
      api.post<Task>(`/tasks/${taskId}/start-route`, position),
    onSuccess: () => invalidateTaskData(qc, taskId),
  });
}

function useTaskStep(taskId: string, step: 'start-service' | 'release') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Task>(`/tasks/${taskId}/${step}`),
    onSuccess: () => invalidateTaskData(qc, taskId),
  });
}

export const useStartService = (taskId: string) => useTaskStep(taskId, 'start-service');
export const useReleaseTask = (taskId: string) => useTaskStep(taskId, 'release');

// ---- balance ---------------------------------------------------------------

/** What the person earned and spent over a range of days (both ends included). */
export function useBalance(range: DateRange) {
  const { from, to } = rangeBounds(range);
  return useQuery({
    queryKey: keys.balance(range),
    queryFn: () =>
      api.get<Balance>('/me/balance', { from: from?.toISOString(), to: to?.toISOString() }),
    // Keep showing the last numbers while the next period loads: no flash of skeleton.
    placeholderData: keepPreviousData,
  });
}

// ---- exchange rates --------------------------------------------------------

/**
 * Today's exchange rates, for the small "≈" conversions next to foreign prices.
 * They change once a day, so one fetch is kept for an hour. If they cannot be
 * had, the conversions are simply not shown.
 */
export function useRates() {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: keys.rates,
    queryFn: () => api.get<Rates>('/rates'),
    enabled: signedIn,
    staleTime: 60 * 60_000,
    retry: 1,
  });
}

// ---- wallet ----------------------------------------------------------------

/** The person's wallet: balance, commission and what they can do with it. */
export function useWallet() {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: keys.wallet,
    queryFn: () => api.get<Wallet>('/me/wallet'),
    enabled: signedIn,
    staleTime: 10_000,
  });
}

export function useWalletTransactions() {
  return useInfiniteQuery({
    queryKey: keys.walletTransactions,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.page<WalletTransaction>('/me/wallet/transactions', {
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.offset + PAGE_SIZE : undefined),
  });
}

/** Whatever changes the wallet refreshes the balance and its history (both live under keys.wallet). */
function useRefreshWallet() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.wallet });
  };
}

export function useTestTopup() {
  const refresh = useRefreshWallet();
  return useMutation({
    mutationFn: (amountMinor: number) =>
      api.post<TopupResult>('/me/wallet/test-topup', { amount_minor: amountMinor }),
    onSuccess: refresh,
  });
}

export function useRedeemCode() {
  const refresh = useRefreshWallet();
  return useMutation({
    mutationFn: (code: string) => api.post<RedeemResult>('/me/wallet/redeem', { code }),
    onSuccess: refresh,
  });
}

/**
 * What it would cost in commission to be chosen for a task at this price, and whether
 * the wallet covers it. Asked again when the price changes.
 */
export function useFeeQuote(taskId: string, priceMinor: number | null, enabled = true) {
  return useQuery({
    queryKey: keys.feeQuote(taskId, priceMinor ?? 0),
    queryFn: () => api.get<FeeQuote>(`/tasks/${taskId}/fee-quote`, { price_minor: priceMinor }),
    enabled: enabled && priceMinor != null && priceMinor > 0,
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  });
}

// ---- administrator ---------------------------------------------------------

export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: [...keys.admin, 'overview'],
    queryFn: () => api.get<AdminOverview>('/admin/overview'),
    enabled,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<PlatformSettings, 'updated_at'>) =>
      api.put<PlatformSettings>('/admin/settings', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.admin });
      void qc.invalidateQueries({ queryKey: keys.wallet });
    },
  });
}

export function useAdminPromotions(enabled: boolean) {
  return useQuery({
    queryKey: [...keys.admin, 'promotions'],
    queryFn: () => api.get<Promotion[]>('/admin/promotions'),
    enabled,
  });
}

export function useCreatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewPromotion) => api.post<Promotion>('/admin/promotions', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.admin }),
  });
}

export function useSetPromotionActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch<Promotion>(`/admin/promotions/${id}`, { active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.admin }),
  });
}

export function useManualCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; amount_minor: number; currency: string; note?: string }) =>
      api.post<TopupResult>('/admin/credit', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.admin }),
  });
}
