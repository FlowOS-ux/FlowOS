/**
 * FlowOS mobile - src/api/types.ts
 * Response/DTO shapes mirroring the backend API.
 */
export type Role = 'CUSTOMER' | 'STAFF' | 'BUSINESS_OWNER' | 'PLATFORM_ADMIN';
export type EntryStatus =
  | 'WAITING'
  | 'CALLED'
  | 'SERVING'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';
export type QueueStatus = 'OPEN' | 'PAUSED' | 'CLOSED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  onboardingComplete: boolean;
  settings: {
    language: string;
    notificationsEnabled: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
  };
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type BusinessStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

export interface BusinessHour {
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  openTime?: string; // "HH:MM"
  closeTime?: string; // "HH:MM"
  isClosed?: boolean;
}

export interface Business {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  location: { lat: number; lng: number };
  phone: string | null;
  logoUrl: string | null;
  hours: BusinessHour[];
  status: BusinessStatus;
  ratingAvg: number;
  ratingCount: number;
  ownerId: string;
}

export interface Queue {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  status: QueueStatus;
  avgServiceSec: number;
  maxCapacity: number | null;
}

export interface Entry {
  id: string;
  queueId: string;
  businessId: string;
  ticketNumber: number;
  status: EntryStatus;
  position?: number | null;
  peopleAhead?: number;
  estimatedWaitSec?: number;
  queueName?: string;
  joinedAt: string;
}

export interface OperatorEntry extends Entry {
  customer: { name: string; avatarUrl?: string };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  joined: number;
  completed: number;
  noShows: number;
  currentlyWaiting: number;
  avgWaitSec: number;
  noShowRate: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
