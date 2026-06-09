/**
 * FlowOS - src/types/index.ts
 * Shared TypeScript types: roles, domain enums, and Express request augmentation.
 */

// ---- Global (platform) roles ----
export const ROLES = ['CUSTOMER', 'STAFF', 'BUSINESS_OWNER', 'PLATFORM_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

// ---- Business-scoped membership roles ----
export const MEMBERSHIP_ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

// ---- Domain enums ----
// PENDING_VERIFICATION -> created/submitted; awaiting admin review (not live)
// APPROVED             -> admin-approved; live (discoverable in Explore + joinable)
// REJECTED             -> admin-rejected; blocked from all business operations
export const BUSINESS_STATUSES = ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/** The only status from which a business is live (Explore + queue operations). */
export const APPROVED_STATUS: BusinessStatus = 'APPROVED';

export const QUEUE_STATUSES = ['OPEN', 'PAUSED', 'CLOSED'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const ENTRY_STATUSES = [
  'WAITING',
  'CALLED',
  'SERVING',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** Entry statuses that count as "active" (block re-join, occupy the queue). */
export const ACTIVE_ENTRY_STATUSES: EntryStatus[] = ['WAITING', 'CALLED', 'SERVING'];

export const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const REVIEW_STATUSES = ['VISIBLE', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'QUEUE_CALLED',
  'POSITION_UPDATE',
  'QUEUE_CLOSED',
  'APPOINTMENT_REMINDER',
  'STAFF_INVITE',
  'GENERIC',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ---- Authenticated user attached to the request by the auth middleware ----
export interface AuthUser {
  id: string;
  role: Role;
}

// ---- JWT payload shape ----
export interface AppJwtPayload {
  sub: string; // user id
  role: Role;
}

// Augment Express so req.user is typed across the app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Parsed query set by the validate() middleware (Express 5 req.query is read-only). */
      validatedQuery?: unknown;
    }
  }
}
