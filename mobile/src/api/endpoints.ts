/**
 * FlowOS mobile - src/api/endpoints.ts
 * Thin typed wrappers around the REST API.
 */
import { api } from './client';
import type {
  AuthResult,
  RegisterResult,
  User,
  Business,
  AdminBusiness,
  Queue,
  Entry,
  OperatorEntry,
  AppNotification,
  AnalyticsSummary,
  Paginated,
  Role,
} from './types';

export const authApi = {
  register: (body: { name: string; email: string; password: string; role?: Role }) =>
    api.post<RegisterResult>('/auth/register', body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResult>('/auth/login', body).then((r) => r.data),
  verifyEmail: (body: { email: string; otp: string }) =>
    api.post<AuthResult>('/auth/verify-email', body).then((r) => r.data),
  resendOtp: (email: string) =>
    api
      .post<{ success: boolean; message: string; devCode?: string }>('/auth/resend-otp', { email })
      .then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }).then((r) => r.data),
};

export const userApi = {
  updateProfile: (body: { name?: string; phone?: string }) =>
    api.patch<{ user: User }>('/users/me', body).then((r) => r.data.user),
  updateSettings: (body: Record<string, unknown>) =>
    api.patch('/users/me/settings', body).then((r) => r.data),
};

export const businessApi = {
  explore: (params: {
    search?: string;
    category?: string;
    page?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) => api.get<Paginated<Business>>('/businesses', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<{ business: Business }>(`/businesses/${id}`).then((r) => r.data.business),
  mine: () => api.get<{ businesses: Business[] }>('/businesses/mine').then((r) => r.data.businesses),
  create: (body: {
    name: string;
    category: string;
    description?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    location?: { lat: number; lng: number };
  }) => api.post<{ business: Business }>('/businesses', body).then((r) => r.data.business),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<{ business: Business }>(`/businesses/${id}`, body).then((r) => r.data.business),
  remove: (id: string) => api.delete(`/businesses/${id}`).then((r) => r.data),
  queues: (businessId: string) =>
    api.get<{ queues: Queue[] }>(`/businesses/${businessId}/queues`).then((r) => r.data.queues),
  createQueue: (
    businessId: string,
    body: { name: string; description?: string; avgServiceSec?: number; maxCapacity?: number },
  ) => api.post<{ queue: Queue }>(`/businesses/${businessId}/queues`, body).then((r) => r.data.queue),
  updateQueue: (
    id: string,
    body: {
      name?: string;
      description?: string;
      status?: 'OPEN' | 'PAUSED' | 'CLOSED';
      avgServiceSec?: number;
      maxCapacity?: number;
    },
  ) => api.patch<{ queue: Queue }>(`/queues/${id}`, body).then((r) => r.data.queue),
  analyticsSummary: (businessId: string) =>
    api
      .get<{ summary: AnalyticsSummary }>(`/businesses/${businessId}/analytics/summary`)
      .then((r) => r.data.summary),
};

export const adminApi = {
  /** Platform admin: verification queues by status. */
  pendingBusinesses: () =>
    api
      .get<{ businesses: AdminBusiness[] }>('/admin/businesses/pending')
      .then((r) => r.data.businesses),
  approvedBusinesses: () =>
    api
      .get<{ businesses: AdminBusiness[] }>('/admin/businesses/approved')
      .then((r) => r.data.businesses),
  rejectedBusinesses: () =>
    api
      .get<{ businesses: AdminBusiness[] }>('/admin/businesses/rejected')
      .then((r) => r.data.businesses),
  approveBusiness: (id: string) =>
    api
      .patch<{ business: AdminBusiness }>(`/admin/businesses/${id}/approve`)
      .then((r) => r.data.business),
  rejectBusiness: (id: string, reason?: string) =>
    api
      .patch<{ business: AdminBusiness }>(`/admin/businesses/${id}/reject`, { reason })
      .then((r) => r.data.business),
};

export const mediaApi = {
  /** Upload an image (multipart, field "file"); returns the hosted absolute URL. */
  upload: (form: FormData) =>
    api.post<{ url: string }>('/media', form).then((r) => r.data.url),
};

export const queueApi = {
  join: (queueId: string) =>
    api.post<{ entry: Entry }>(`/queues/${queueId}/join`).then((r) => r.data.entry),
  operatorList: (queueId: string) =>
    api
      .get<{ entries: OperatorEntry[] }>(`/queues/${queueId}/entries`)
      .then((r) => r.data.entries),
  callNext: (queueId: string) =>
    api.post<{ entry: Entry }>(`/queues/${queueId}/call-next`).then((r) => r.data.entry),
};

export const entryApi = {
  mine: () => api.get<{ entries: Entry[] }>('/entries/me').then((r) => r.data.entries),
  leave: (id: string) => api.delete(`/entries/${id}`).then((r) => r.data),
  serve: (id: string) =>
    api.post<{ entry: Entry }>(`/entries/${id}/serve`).then((r) => r.data.entry),
  complete: (id: string) =>
    api.post<{ entry: Entry }>(`/entries/${id}/complete`).then((r) => r.data.entry),
  noShow: (id: string) =>
    api.post<{ entry: Entry }>(`/entries/${id}/no-show`).then((r) => r.data.entry),
};

export const notificationApi = {
  list: () =>
    api
      .get<{ items: AppNotification[]; unread: number }>('/notifications')
      .then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
  registerDevice: (token: string, platform: string) =>
    api.post('/notifications/devices', { token, platform }).then((r) => r.data),
  removeDevice: (token: string) =>
    api.delete(`/notifications/devices/${encodeURIComponent(token)}`).then((r) => r.data),
};
