import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// CSRF token management
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const response = await axios.get<{ token: string }>('/api/csrf-token', {
    withCredentials: true,
  });
  const token = response.data.token;
  csrfToken = token;
  return token;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  // Avoid duplicate concurrent fetches
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().finally(() => {
      csrfTokenPromise = null;
    });
  }
  return csrfTokenPromise;
}

// Inject CSRF token header on mutation requests
api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// If a request fails with 403 (token may have expired), refresh token and retry once
api.interceptors.response.use(undefined, async (error) => {
  const originalRequest = error.config;
  if (
    error.response?.status === 403 &&
    !originalRequest._csrfRetry
  ) {
    originalRequest._csrfRetry = true;
    csrfToken = null;
    const token = await getCsrfToken();
    originalRequest.headers['X-CSRF-Token'] = token;
    return api.request(originalRequest);
  }
  return Promise.reject(error);
});

export interface User {
  id: string;
  email: string;
  name: string;
  isManager: boolean;
  isAdmin: boolean;
}

export interface Balance {
  posted: number;
  pending: number;
  total: number;
}

export interface FullBalance {
  personal: Balance;
  allotment: Balance | null;
  isManager: boolean;
}

export interface Allotment {
  id: string;
  managerId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  recurringBudget: number;
  balance: number;
  usedThisPeriod: number;
  // For backward compatibility
  amount: number;
  usedAmount: number;
  remaining: number;
}

export interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  status: string;
  description: string | null;
  createdAt: string;
  postedAt: string | null;
  sourceEmployee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WellnessTask {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  coinValue: number;
  frequencyRule: string;
  formTemplateUrl: string | null;
  maxRewardedUsers: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WellnessSubmission {
  id: string;
  employeeId?: string;
  wellnessTaskId?: string;
  wellnessTask: WellnessTask;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  documentUrl: string;
  transaction?: {
    id: string;
    status: string;
    amount: number;
  } | null;
}

export interface EmailTemplate {
  key: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  isEnabled: boolean;
  variables: string[];
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  amazonUrl: string | null;
  source: string;
  priceUsd: number | null;
  priceGuincoin: number;
  isActive: boolean;
}

// Auth
export const getCurrentUser = () => api.get<User>('/auth/me');
export const logout = () => api.post('/auth/logout');

// Accounts
export const getBalance = () => api.get<Balance>('/accounts/balance');
export const getFullBalance = () => api.get<FullBalance>('/accounts/full-balance');
export const getTransactions = (params?: {
  limit?: number;
  offset?: number;
  status?: string;
  transactionType?: string;
}) => api.get<{ transactions: Transaction[]; total: number }>('/accounts/transactions', { params });
export const getPendingTransactions = () => api.get<Transaction[]>('/accounts/pending');

// Manager
export const getManagerAllotment = () => api.get<Allotment>('/manager/allotment');
export const awardCoins = (data: { employeeEmail: string; amount: number; description?: string }) =>
  api.post<{ message: string; transaction: Transaction; newAllotmentBalance: number }>('/manager/award', data);
export const getAwardHistory = (params?: { limit?: number; offset?: number }) =>
  api.get('/manager/history', { params });
export const getManagerDeposits = (params?: { limit?: number; offset?: number }) =>
  api.get('/manager/deposits', { params });

// Transfers
export const getTransferLimits = () => api.get('/transfers/limits');
export const sendTransfer = (data: { recipientEmail: string; amount: number; message?: string }) =>
  api.post('/transfers/send', data);
export const getTransferHistory = () => api.get('/transfers/history');
export const getPendingTransfers = () => api.get('/transfers/pending');
export const cancelTransfer = (transferId: string) => api.post(`/transfers/${transferId}/cancel`);

// Wellness
export const getWellnessTasks = () => api.get<WellnessTask[]>('/wellness/tasks');
export const getWellnessTask = (id: string) => api.get<WellnessTask>(`/wellness/tasks/${id}`);
export const submitWellness = (formData: FormData) =>
  api.post('/wellness/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getWellnessSubmissions = () => api.get<WellnessSubmission[]>('/wellness/submissions');

// Admin
export const getPendingSubmissions = () => api.get('/admin/wellness/pending');
export const approveSubmission = (id: string) => api.post(`/admin/wellness/${id}/approve`);
export const rejectSubmission = (id: string, reason?: string) =>
  api.post(`/admin/wellness/${id}/reject`, { reason });
export const createWellnessTask = (formData: FormData) =>
  api.post('/admin/wellness/tasks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getAllWellnessTasks = () => api.get<WellnessTask[]>('/admin/wellness/tasks');
export const deleteWellnessTask = (id: string) => api.delete(`/admin/wellness/tasks/${id}`);
export const getAllUsersWithSubmissions = () => api.get('/admin/wellness/users');
export const getUserSubmissions = (userId: string) =>
  api.get<WellnessSubmission[]>(`/admin/wellness/users/${userId}/submissions`);
export const getEmailTemplates = () => api.get<EmailTemplate[]>('/admin/email-templates');
export const updateEmailTemplate = (
  key: string,
  data: { subject: string; html: string; isEnabled?: boolean }
) => api.put(`/admin/email-templates/${key}`, data);

export interface PurchaseOrder {
  id: string;
  employeeId: string;
  productId: string;
  transactionId: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  fulfilledById: string | null;
  fulfilledAt: string | null;
  shippingAddress: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  product: StoreProduct;
  priceGuincoin: number;
  employee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WishlistItem {
  id: string;
  employeeId: string;
  productId: string;
  createdAt: string;
  product: StoreProduct;
}

export interface Goal {
  id: string;
  employeeId: string;
  productId: string;
  targetAmount: number;
  currentAmount: number;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  product: StoreProduct;
}

// Store
export const getStoreProducts = () => api.get<StoreProduct[]>('/store/products');
export const createCustomProduct = (formData: FormData) =>
  api.post('/admin/store/products/custom', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const seedStoreProduct = () => api.post('/admin/store/products/seed');
export const importAmazonProduct = (url: string) =>
  api.post('/admin/store/products/amazon', { url });
export const importAmazonList = (url: string, limit?: number) =>
  api.post('/admin/store/products/amazon-list', { url, limit });
export const getAdminStoreProducts = () => api.get<StoreProduct[]>('/admin/store/products');
export const toggleProductStatus = (productId: string) =>
  api.patch<{ message: string; product: StoreProduct }>(`/admin/store/products/${productId}/toggle`);
export const deleteProduct = (productId: string) =>
  api.delete<{ message: string; id: string; softDeleted: boolean }>(`/admin/store/products/${productId}`);

// Store Purchases
export const purchaseProduct = (data: { productId: string; shippingAddress?: string }) =>
  api.post<{ purchaseOrder: PurchaseOrder; newBalance: Balance }>('/store/purchase', data);
export const getPurchases = () => api.get<PurchaseOrder[]>('/store/purchases');

// Wishlist
export const addToWishlist = (productId: string) =>
  api.post<{ wishlistItem: WishlistItem }>(`/store/wishlist/${productId}`);
export const removeFromWishlist = (productId: string) => api.delete(`/store/wishlist/${productId}`);
export const getWishlist = () => api.get<WishlistItem[]>('/store/wishlist');

// Goals
export const createGoal = (data: { productId: string; targetAmount: number }) =>
  api.post<{ goal: Goal }>('/store/goals', data);
export const getGoals = () => api.get<Goal[]>('/store/goals');
export const deleteGoal = (goalId: string) => api.delete(`/store/goals/${goalId}`);
export const checkGoalAchievements = () =>
  api.get<{ hasNewAchievements: boolean; goals: Goal[] }>('/store/goals/check-achievements');

// Admin - Purchases
export const getPendingPurchases = () => api.get<PurchaseOrder[]>('/admin/purchases/pending');
export const getAllPurchases = (status?: string) =>
  api.get<PurchaseOrder[]>('/admin/purchases', { params: { status } });
export const fulfillPurchase = (id: string, data?: { trackingNumber?: string; notes?: string }) =>
  api.post<{ purchaseOrder: PurchaseOrder }>(`/admin/purchases/${id}/fulfill`, data);

// Admin - Users/Roles
export interface Employee {
  id: string;
  email: string;
  name: string;
  isManager: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export const getAllEmployees = () => api.get<Employee[]>('/admin/users');
export const createEmployee = (data: { email: string; name: string; isManager?: boolean; isAdmin?: boolean }) =>
  api.post<Employee>('/admin/users', data);
export const updateEmployeeRoles = (id: string, data: { isManager?: boolean; isAdmin?: boolean }) =>
  api.put<Employee>(`/admin/users/${id}/roles`, data);

// Admin - Allotment Management
export interface ManagerAllotmentDetails {
  employee: {
    id: string;
    name: string;
    email: string;
  };
  allotment: {
    balance: number;
    recurringBudget: number;
    usedThisPeriod: number;
    periodStart: string;
    periodEnd: string;
  };
  recentDeposits: Array<{
    id: string;
    amount: number;
    description: string;
    createdAt: string;
    fromAdmin: string;
  }>;
  recentAwards: Array<{
    id: string;
    amount: number;
    description: string;
    createdAt: string;
    toEmployee: string;
  }>;
}

export const getManagerAllotmentDetails = (managerId: string) =>
  api.get<ManagerAllotmentDetails>(`/admin/users/${managerId}/allotment`);
export const depositAllotment = (managerId: string, data: { amount: number; description?: string }) =>
  api.post<{ message: string; transaction: { id: string; amount: number }; newBalance: number }>(
    `/admin/users/${managerId}/allotment/deposit`,
    data
  );
export const setRecurringBudget = (managerId: string, data: { amount: number; periodType?: 'monthly' | 'quarterly' }) =>
  api.put<{ message: string; amount: number; periodType: string }>(
    `/admin/users/${managerId}/allotment/recurring`,
    data
  );

// Admin - Google Chat
export interface ChatCommandAudit {
  id: string;
  provider: string;
  eventType: string | null;
  messageId: string | null;
  spaceName: string | null;
  threadName: string | null;
  userEmail: string | null;
  commandText: string | null;
  commandName: string | null;
  status: 'received' | 'authorized' | 'rejected' | 'failed' | 'succeeded';
  transactionId: string | null;
  errorMessage: string | null;
  createdAt: string;
  transaction?: {
    id: string;
    amount: number;
    description: string | null;
    createdAt: string;
  } | null;
}

export interface ChatAuditLogsResponse {
  data: ChatCommandAudit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChatAuditStats {
  total: number;
  recentActivity: number;
  byStatus: {
    received: number;
    authorized: number;
    rejected: number;
    failed: number;
    succeeded: number;
  };
}

export const getGoogleChatAuditLogs = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  userEmail?: string;
  startDate?: string;
  endDate?: string;
}) => api.get<ChatAuditLogsResponse>('/admin/google-chat/audit-logs', { params });

export const getGoogleChatStats = () => api.get<ChatAuditStats>('/admin/google-chat/stats');

// Admin - Balance Report
export interface BalanceReportRow {
  employeeId: string;
  name: string;
  email: string;
  isManager: boolean;
  isAdmin: boolean;
  userBalance: number;
  allotment: {
    total: number;
    used: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  } | null;
}

export interface BalanceReport {
  reportData: BalanceReportRow[];
  totals: {
    totalUserBalances: number;
    totalAllotmentRemaining: number;
    totalInCirculation: number;
  };
  generatedAt: string;
}

export const getBalanceReport = () => api.get<BalanceReport>('/admin/users/balances-report');

// =====================
// Campaigns
// =====================

export interface CampaignTheme {
  primaryColor: string;
  primaryHoverColor: string;
  primaryLightColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  presetName?: string;
  backgroundImageUrl?: string;
  backgroundPattern?: string;
  enableAnimations?: boolean;
  animationType?: 'confetti' | 'particles' | 'gradient' | 'none';
}

export interface CampaignTask {
  id: string;
  campaignId: string;
  wellnessTaskId: string | null;
  name: string | null;
  description: string | null;
  coinValue: number | null;
  bonusMultiplier: number;
  displayOrder: number;
  createdAt: string;
  wellnessTask?: {
    id: string;
    name: string;
    description: string | null;
    coinValue: number;
    frequencyRule: string;
    isActive: boolean;
  } | null;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  startDate: string | null;  // Optional
  endDate: string | null;    // Optional
  theme: CampaignTheme;
  bannerImageUrl: string | null;
  posterImageUrl: string | null;
  emailBannerUrl: string | null;
  chatImageUrl: string | null;
  aiPromptUsed: string | null;
  emailSentAt: string | null;
  chatPostedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  campaignTasks?: CampaignTask[];
  _count?: {
    campaignTasks: number;
  };
}

export interface CampaignCreateInput {
  name: string;
  description?: string;
  slug?: string;
  startDate?: string;  // Optional - leave empty for no date restriction
  endDate?: string;    // Optional - leave empty for no date restriction
  theme: CampaignTheme;
}

export interface CampaignUpdateInput {
  name?: string;
  description?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  status?: Campaign['status'];
  theme?: CampaignTheme;
}

export interface ImageGenerationResult {
  url: string;
  localPath: string;
  filename: string;
}

export interface CampaignImagesResult {
  banner?: ImageGenerationResult;
  poster?: ImageGenerationResult;
  emailBanner?: ImageGenerationResult;
  chatImage?: ImageGenerationResult;
}

export interface DistributionResult {
  success: boolean;
  recipientCount: number;
  errors: string[];
  message: string;
}

// Campaign API functions
export const getCampaigns = (params?: { status?: Campaign['status']; search?: string }) =>
  api.get<Campaign[]>('/admin/campaigns', { params });

export const getActiveCampaign = () =>
  api.get<Campaign | null>('/admin/campaigns/active');

export const getCampaign = (id: string) =>
  api.get<Campaign>(`/admin/campaigns/${id}`);

export const createCampaign = (data: CampaignCreateInput) =>
  api.post<Campaign>('/admin/campaigns', data);

export const updateCampaign = (id: string, data: CampaignUpdateInput) =>
  api.put<Campaign>(`/admin/campaigns/${id}`, data);

export const deleteCampaign = (id: string) =>
  api.delete(`/admin/campaigns/${id}`);

export const activateCampaign = (id: string) =>
  api.post<Campaign>(`/admin/campaigns/${id}/activate`);

export const deactivateCampaign = (id: string) =>
  api.post<Campaign>(`/admin/campaigns/${id}/deactivate`);

export const toggleCampaign = (id: string) =>
  api.post<Campaign>(`/admin/campaigns/${id}/toggle`);

// Campaign Tasks
export const getCampaignTasks = (campaignId: string) =>
  api.get<CampaignTask[]>(`/admin/campaigns/${campaignId}/tasks`);

export const linkTaskToCampaign = (campaignId: string, data: {
  wellnessTaskId: string;
  bonusMultiplier?: number;
  displayOrder?: number;
}) =>
  api.post<CampaignTask>(`/admin/campaigns/${campaignId}/tasks`, data);

export const createCampaignExclusiveTask = (campaignId: string, data: {
  name: string;
  description?: string;
  coinValue: number;
  displayOrder?: number;
}) =>
  api.post<CampaignTask>(`/admin/campaigns/${campaignId}/tasks/create`, data);

export const updateCampaignTask = (campaignId: string, taskId: string, data: {
  bonusMultiplier?: number;
  displayOrder?: number;
  name?: string;
  description?: string;
  coinValue?: number;
}) =>
  api.put<CampaignTask>(`/admin/campaigns/${campaignId}/tasks/${taskId}`, data);

export const unlinkCampaignTask = (campaignId: string, taskId: string) =>
  api.delete(`/admin/campaigns/${campaignId}/tasks/${taskId}`);

// Theme presets
export const getThemePresets = () =>
  api.get<Record<string, CampaignTheme>>('/admin/campaigns/theme-presets');

// AI Image Generation
export const getAIStatus = (campaignId: string) =>
  api.get<{ available: boolean; message: string }>(`/admin/campaigns/${campaignId}/ai-status`);

export const generateCampaignImages = (campaignId: string, data: {
  prompt?: string;
  generateBanner?: boolean;
  generatePoster?: boolean;
  generateEmailBanner?: boolean;
  generateChatImage?: boolean;
}) =>
  api.post<{ message: string; images: CampaignImagesResult }>(`/admin/campaigns/${campaignId}/generate-images`, data);

export const regenerateCampaignImage = (campaignId: string, type: 'banner' | 'poster' | 'emailBanner' | 'chatImage', prompt?: string) =>
  api.post<{ message: string; image: ImageGenerationResult }>(`/admin/campaigns/${campaignId}/regenerate/${type}`, { prompt });

export const getCampaignAssets = (campaignId: string) =>
  api.get<{
    bannerImageUrl: string | null;
    posterImageUrl: string | null;
    emailBannerUrl: string | null;
    chatImageUrl: string | null;
    aiPromptUsed: string | null;
  }>(`/admin/campaigns/${campaignId}/assets`);

// Campaign Distribution
export const sendCampaignEmail = (campaignId: string, recipientType?: 'all' | 'managers' | 'employees') =>
  api.post<DistributionResult>(`/admin/campaigns/${campaignId}/send-email`, { recipientType });

export const postCampaignToChat = (campaignId: string, webhookUrl: string) =>
  api.post<DistributionResult>(`/admin/campaigns/${campaignId}/post-chat`, { webhookUrl });

export const getDistributionStatus = (campaignId: string) =>
  api.get<{
    emailSentAt: string | null;
    chatPostedAt: string | null;
    hasImages: boolean;
  }>(`/admin/campaigns/${campaignId}/distribution-status`);

export const getDownloadableAssets = (campaignId: string) =>
  api.get<{
    bannerImageUrl: string | null;
    posterImageUrl: string | null;
    emailBannerUrl: string | null;
    chatImageUrl: string | null;
  }>(`/admin/campaigns/${campaignId}/downloadable-assets`);

// =====================
// Campaign Studio
// =====================

export type ThemeMode = 'manual' | 'campaign';

export interface SystemSettings {
  id: string;
  themeMode: ThemeMode;
  manualTheme: CampaignTheme | null;
  updatedAt: string;
}

export interface StudioState {
  settings: SystemSettings;
  activeCampaign: {
    id: string;
    name: string;
    status: string;
    theme: CampaignTheme;
  } | null;
  currentTheme: CampaignTheme;
}

export interface ActivateCampaignFullOptions {
  applyTheme?: boolean;
  sendEmail?: boolean;
  postChat?: boolean;
  emailRecipientType?: 'all' | 'managers' | 'employees';
  chatWebhookUrl?: string;
}

export interface ActivateCampaignFullResult {
  campaign: Campaign;
  themeApplied: boolean;
  emailSent: boolean;
  chatPosted: boolean;
  errors: string[];
}

// Studio API functions
export const getStudioState = () =>
  api.get<StudioState>('/admin/studio/state');

export const getStudioSettings = () =>
  api.get<SystemSettings>('/admin/studio/settings');

export const setThemeMode = (mode: ThemeMode) =>
  api.patch<SystemSettings>('/admin/theme/mode', { mode });

export const setManualTheme = (theme: CampaignTheme, switchToManualMode = true) =>
  api.patch<SystemSettings>('/admin/theme/manual', { theme, switchToManualMode });

export const getCurrentTheme = () =>
  api.get<CampaignTheme>('/admin/theme/current');

export const activateCampaignFull = (campaignId: string, options: ActivateCampaignFullOptions) =>
  api.post<ActivateCampaignFullResult>(`/admin/campaigns/${campaignId}/activate-full`, options);

// =====================
// Games
// =====================

export type GameType = 'coin_flip' | 'dice_roll' | 'spin_wheel' | 'higher_lower' | 'scratch_card' | 'daily_bonus';

export interface GameConfig {
  gameType: GameType;
  enabled: boolean;
  minBet: number;
  maxBet: number;
  jackpotContributionRate: number;
  availableInChat: boolean;
  availableOnWeb: boolean;
}

export interface GameResult {
  outcome: Record<string, unknown>;
  won: boolean;
  payout: number;
  jackpotContribution: number;
}

export interface PlayGameResponse {
  game: {
    id: string;
    type: GameType;
    status: string;
    createdAt: string;
    completedAt: string;
  };
  result: GameResult;
  balance: number;
}

export interface GameHistory {
  id: string;
  type: GameType;
  status: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
  participant: {
    betAmount: number;
    prediction: unknown;
    payout: number | null;
    isWinner: boolean | null;
  } | null;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalBet: number;
  totalWon: number;
  netProfit: number;
  currentWinStreak: number;
  longestWinStreak: number;
  jackpotsWon: number;
  totalJackpotWinnings: number;
  statsByGame: Record<string, {
    played: number;
    won: number;
    totalBet: number;
    totalWon: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  employeeId: string;
  name: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  netProfit: number;
  longestWinStreak: number;
}

export interface Jackpot {
  id: string;
  name: string;
  type: 'rolling' | 'daily' | 'weekly' | 'event';
  balance: number;
  lastWonAt: string | null;
  lastWonBy: string | null;
  lastWonAmount: number | null;
  contributorCount?: number;
}

export interface JackpotSpinResult {
  won: boolean;
  amount: number;
  jackpotId: string;
  newJackpotBalance: number;
  spinAnimation?: {
    segments: Array<{ label: string; isWinner: boolean }>;
    winningIndex: number;
  };
}

export interface DailyBonusStatus {
  canPlay: boolean;
  nextAvailable: string | null;
  wheelConfig: {
    segments: Array<{ prize: number; label: string; color: string }>;
    expectedValue: number;
  };
  recentSpins: Array<{
    prize: number;
    segmentIndex: number;
    date: string;
  }>;
}

// Games API functions
export const getGameConfigs = () =>
  api.get<GameConfig[]>('/games/config');

export const getGameConfig = (gameType: GameType) =>
  api.get<{ gameType: GameType; config: GameConfig; ui: unknown }>(`/games/config/${gameType}`);

export const playGame = (data: {
  gameType: GameType;
  bet: number;
  prediction?: unknown;
  clientSeed?: string;
}) =>
  api.post<PlayGameResponse>('/games/play', data);

export const getGameHistory = (params?: {
  limit?: number;
  offset?: number;
  type?: GameType;
}) =>
  api.get<{
    games: GameHistory[];
    pagination: { limit: number; offset: number; hasMore: boolean };
  }>('/games/history', { params });

export const getGameStats = () =>
  api.get<GameStats>('/games/stats');

export const getLeaderboard = (params?: { limit?: number; period?: 'all' | 'week' | 'month' }) =>
  api.get<{
    leaderboard: LeaderboardEntry[];
    currentUser: { stats: GameStats; rank: number | null };
  }>('/games/leaderboard', { params });

export const getDailyBonusStatus = () =>
  api.get<DailyBonusStatus>('/games/daily-bonus/status');

export const getJackpots = () =>
  api.get<{ jackpots: Jackpot[]; spinCosts: number[] }>('/games/jackpots');

export const getJackpotDetails = (jackpotId: string) =>
  api.get<{
    jackpot: Jackpot;
    recentContributions: Array<{
      employeeId: string;
      employeeName: string;
      amount: number;
      gameType: string;
      createdAt: string;
    }>;
    topContributors: Array<{
      employeeId: string;
      employeeName: string;
      totalContributed: number;
    }>;
  }>(`/games/jackpots/${jackpotId}`);

export const spinJackpot = (data: {
  jackpotId: string;
  betAmount: number;
  clientSeed?: string;
}) =>
  api.post<{ result: JackpotSpinResult; balance: number }>('/games/jackpots/spin', data);

export const verifyGame = (data: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  expectedOutcome: number;
  maxValue: number;
}) =>
  api.post<{ isValid: boolean; providedData: typeof data }>('/games/verify', data);

export default api;
