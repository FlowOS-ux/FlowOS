/**
 * FlowOS - src/modules/admin/admin.service.ts
 * Admin business-verification: list by status (with owner details), approve, reject.
 * Approve/reject record an audit trail (approvedBy/at, rejectedBy/at), append an
 * analytics audit event, and notify the owner. RBAC is enforced at the route.
 */
import { businessesRepository } from '../businesses/businesses.repository';
import { AnalyticsEvent, type BusinessDoc } from '../../models';
import { notifications } from '../../container';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { BusinessStatus } from '../../types';
import type { RejectBusinessDto } from './admin.schema';

type PopulatedOwner = { _id?: unknown; name?: string; email?: string; phone?: string } | null;

/** Admin-facing business view incl. owner contact + submission/decision audit fields. */
function toAdminBusiness(b: BusinessDoc) {
  const owner = b.ownerId as unknown as PopulatedOwner;
  const coords = b.location?.coordinates ?? [0, 0];
  return {
    id: b.id as string,
    name: b.name,
    category: b.category,
    description: b.description ?? null,
    address: b.address ?? null,
    phone: b.phone ?? null,
    email: b.email ?? null,
    website: b.website ?? null,
    logoUrl: b.logoUrl ?? null,
    location: { lng: coords[0], lat: coords[1] },
    status: b.status,
    rejectionReason: b.rejectionReason ?? null,
    submittedAt: b.createdAt,
    approvedAt: b.approvedAt ?? null,
    rejectedAt: b.rejectedAt ?? null,
    owner:
      owner && owner._id
        ? {
            id: String(owner._id),
            name: owner.name ?? null,
            email: owner.email ?? null,
            phone: owner.phone ?? null,
          }
        : { id: String(b.ownerId), name: null, email: null, phone: null },
  };
}

/** Append-only audit event for a verification decision (never fails the request). */
async function audit(type: string, adminId: string, business: BusinessDoc): Promise<void> {
  try {
    await AnalyticsEvent.create({
      type,
      businessId: business.id,
      userId: adminId,
      payload: { name: business.name, status: business.status },
    });
    logger.info(
      { type, businessId: String(business.id), adminId },
      'admin verification decision',
    );
  } catch (err) {
    logger.error({ err, type }, 'failed to write verification audit event');
  }
}

/** Best-effort owner notification on a verification decision (never fails the request). */
async function notifyOwner(
  ownerId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await notifications.notify(ownerId, { type: 'GENERIC', title, body, data });
  } catch (err) {
    logger.error({ err }, 'failed to notify business owner of verification decision');
  }
}

export const adminService = {
  /** List businesses of a given status with owner contact details. */
  async listBusinessesByStatus(status: BusinessStatus) {
    const businesses = await businessesRepository.listByStatusWithOwner(status);
    return businesses.map(toAdminBusiness);
  },

  /** Approve a pending business -> APPROVED (now live, owner gains full access). */
  async approve(adminId: string, id: string) {
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');
    if (business.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestError('Only a business pending verification can be approved');
    }

    const updated = await businessesRepository.updateById(id, {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: adminId,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    });
    await audit('BUSINESS_APPROVED', adminId, updated!);
    await notifyOwner(
      String(updated!.ownerId),
      'Business approved 🎉',
      `${updated!.name} is now live and visible to customers.`,
      { businessId: id, status: 'APPROVED' },
    );
    await updated!.populate('ownerId', 'name email phone');
    return toAdminBusiness(updated!);
  },

  /** Reject a pending business -> REJECTED (blocked from all business operations). */
  async reject(adminId: string, id: string, dto: RejectBusinessDto) {
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');
    if (business.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestError('Only a business pending verification can be rejected');
    }

    const updated = await businessesRepository.updateById(id, {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedBy: adminId,
      rejectionReason: dto.reason ?? null,
      approvedAt: null,
      approvedBy: null,
    });
    await audit('BUSINESS_REJECTED', adminId, updated!);
    await notifyOwner(
      String(updated!.ownerId),
      'Business not approved',
      dto.reason
        ? `${updated!.name} was not approved: ${dto.reason}`
        : `${updated!.name} was not approved by the review team.`,
      { businessId: id, status: 'REJECTED' },
    );
    await updated!.populate('ownerId', 'name email phone');
    return toAdminBusiness(updated!);
  },
};
