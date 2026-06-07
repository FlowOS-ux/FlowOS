/**
 * FlowOS mobile - src/api/endpoints.ts
 * Thin typed wrappers around the REST API.
 */
import { api } from './client';
import type {
  AuthResult,
  User,
  Business,
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
    api.post<AuthResult>('/auth/register', body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResult>('/auth/login', body).then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
};

export const userApi = {
  updateProfile: (body: { name?: string; phone?: string }) =>
    api.patch<{ user: User }>('/users/me', body).then((r) => r.data.user),
  updateSettings: (body: Record<string, unknown>) =>
    api.patch('/users/me/settings', body).then((r) => r.data),
};

export const businessApi = {
  explore: (params: { search?: string; category?: string; page?: number }) =>
    api.get<Paginated<Business>>('/businesses', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<{ business: Business }>(`/businesses/${id}`).then((r) => r.data.business),
  mine: () => api.get<{ businesses: Business[] }>('/businesses/mine').then((r) => r.data.businesses),
  create: (body: {
    name: string;
    category: string;
    description?: string;
    address?: string;
    phone?: string;
    location?: { lat: number; lng: number };
  }) => api.post<{ business: Business }>('/businesses', body).then((r) => r.data.business),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<{ business: Business }>(`/businesses/${id}`, body).then((r) => r.data.business),
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
};
