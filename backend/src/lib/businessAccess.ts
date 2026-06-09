/**
 * FlowOS - src/lib/businessAccess.ts
 * Business-scoped RBAC helper. Resolves a user's membership role for a business and
 * asserts a minimum required role. PLATFORM_ADMIN bypasses scoping.
 */
import { Business, StaffMember } from '../models';
import { ForbiddenError, NotFoundError } from './errors';
import { APPROVED_STATUS, type MembershipRole, type Role } from '../types';

const RANK: Record<MembershipRole, number> = { STAFF: 1, MANAGER: 2, OWNER: 3 };

export async function getBusinessRole(
  userId: string,
  businessId: string,
): Promise<MembershipRole | null> {
  const membership = await StaffMember.findOne({
    userId,
    businessId,
    status: 'ACTIVE',
  }).lean();
  return (membership?.role as MembershipRole | undefined) ?? null;
}

/** Throws ForbiddenError unless the user holds at least `min` role at the business. */
export async function assertBusinessRole(
  userId: string,
  businessId: string,
  min: MembershipRole,
  platformRole?: Role,
): Promise<void> {
  if (platformRole === 'PLATFORM_ADMIN') return;
  const role = await getBusinessRole(userId, businessId);
  if (!role || RANK[role] < RANK[min]) {
    throw new ForbiddenError('You do not have permission for this business');
  }
}

/**
 * Gate for business operations (queue create/manage, customer/operator actions).
 * Throws 403 unless the business has been admin-approved.
 */
export async function assertBusinessApproved(businessId: string): Promise<void> {
  const business = await Business.findById(businessId).select('status').lean();
  if (!business) throw new NotFoundError('Business not found');
  if (business.status !== APPROVED_STATUS) {
    throw new ForbiddenError('Business approval is pending.');
  }
}
