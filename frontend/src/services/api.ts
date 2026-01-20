import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export interface User {
  id: string;
  email: string;
  name: string;
  isManager: boolean;
}

export interface Balance {
  posted: number;
  pending: number;
  total: number;
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
export const getTransactions = (params?: {
  limit?: number;
  offset?: number;
  status?: string;
  transactionType?: string;
}) => api.get<{ transactions: Transaction[]; total: number }>('/accounts/transactions', { params });
export const getPendingTransactions = () => api.get<Transaction[]>('/accounts/pending');

// Manager
export const getManagerAllotment = () => api.get('/manager/allotment');
export const awardCoins = (data: { employeeEmail: string; amount: number; description?: string }) =>
  api.post('/manager/award', data);
export const getAwardHistory = (params?: { limit?: number; offset?: number }) =>
  api.get('/manager/history', { params });

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

export default api;
