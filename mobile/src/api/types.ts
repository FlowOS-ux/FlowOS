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
  emailVerified: boolean;
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

export interface RegisterResult {
  status: 'VERIFICATION_REQUIRED';
  email: string;
  /** Demo only (non-production backend): the code, surfaced so testers can self-verify. */
  devCode?: string;
}

export type BusinessStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';

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
  rejectionReason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  ownerId: string;
}

/** Admin-facing business view (verification dashboard): includes owner contact + audit. */
export interface AdminBusiness {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  location: { lat: number; lng: number };
  phone: string | null;
  logoUrl: string | null;
  status: BusinessStatus;
  rejectionReason: string | null;
  submittedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  owner: { id: string; name: string | null; email: string | null; phone: string | null };
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
