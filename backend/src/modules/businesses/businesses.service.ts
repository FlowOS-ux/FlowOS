/**
 * FlowOS - src/modules/businesses/businesses.service.ts
 * Business registration, setup/management, ownership, and Explore search.
 */
import type { FilterQuery } from 'mongoose';
import { businessesRepository } from './businesses.repository';
import { queuesRepository } from '../queues/queues.repository';
import { entriesRepository } from '../entries/entries.repository';
import { membershipsRepository } from '../memberships/memberships.repository';
import { StaffMember, type BusinessDoc } from '../../models';
import { assertBusinessRole } from '../../lib/businessAccess';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { notifications } from '../../container';
import { SUBMITTABLE_STATUSES, type Role } from '../../types';
import type {
  CreateBusinessDto,
  UpdateBusinessDto,
  RejectBusinessDto,
  ExploreQuery,
} from './businesses.schema';

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

export function toPublicBusiness(b: BusinessDoc) {
  const coords = b.location?.coordinates ?? [0, 0];
  return {
    id: b.id as string,
    name: b.name,
    category: b.category,
    description: b.description ?? null,
    address: b.address ?? null,
    location: { lng: coords[0], lat: coords[1] },
    phone: b.phone ?? null,
    logoUrl: b.logoUrl ?? null,
    hours: b.hours ?? [],
    status: b.status,
    rejectionReason: b.rejectionReason ?? null,
    ratingAvg: b.ratingAvg,
    ratingCount: b.ratingCount,
    ownerId: String(b.ownerId),
    createdAt: b.createdAt,
  };
}

export const businessesService = {
  async register(ownerId: string, dto: CreateBusinessDto) {
    const business = await businessesRepository.create({
      name: dto.name,
      category: dto.category,
      description: dto.description,
      address: dto.address,
      phone: dto.phone,
      logoUrl: dto.logoUrl,
      ownerId,
      status: 'DRAFT',
      location: dto.location
        ? { type: 'Point', coordinates: [dto.location.lng, dto.location.lat] }
        : undefined,
    });

    // The owner is also recorded as a staff member with the OWNER role.
    await StaffMember.create({ userId: ownerId, businessId: business.id, role: 'OWNER' });

    return toPublicBusiness(business);
  },

  async getById(id: string) {
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');
    return toPublicBusiness(business);
  },

  async update(userId: string, role: Role, id: string, dto: UpdateBusinessDto) {
    await assertBusinessRole(userId, id, 'MANAGER', role);

    const update: Record<string, unknown> = { ...dto };
    if (dto.location) {
      update.location = { type: 'Point', coordinates: [dto.location.lng, dto.location.lat] };
    }

    const business = await businessesRepository.updateById(id, update);
    if (!business) throw new NotFoundError('Business not found');
    return toPublicBusiness(business);
  },

  // ---- Verification lifecycle ----

  /** Owner submits a DRAFT/REJECTED business for admin review -> PENDING_VERIFICATION. */
  async submitForReview(userId: string, role: Role, id: string) {
    await assertBusinessRole(userId, id, 'MANAGER', role);
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');

    if (!SUBMITTABLE_STATUSES.includes(business.status)) {
      throw new BadRequestError(
        `A ${business.status} business cannot be submitted for review`,
      );
    }

    const updated = await businessesRepository.updateById(id, {
      status: 'PENDING_VERIFICATION',
      rejectionReason: null,
    });
    return toPublicBusiness(updated!);
  },

  /** Admin: list businesses awaiting verification (RBAC enforced at the route). */
  async listPending() {
    const businesses = await businessesRepository.listByStatus('PENDING_VERIFICATION');
    return businesses.map(toPublicBusiness);
  },

  /** Admin: approve a pending business -> ACTIVE (now discoverable + joinable). */
  async approve(id: string) {
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');
    if (business.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestError('Only a business pending verification can be approved');
    }

    const updated = await businessesRepository.updateById(id, {
      status: 'ACTIVE',
      rejectionReason: null,
    });
    await notifyOwner(
      String(updated!.ownerId),
      'Business approved 🎉',
      `${updated!.name} is now live and visible to customers.`,
      { businessId: id, status: 'ACTIVE' },
    );
    return toPublicBusiness(updated!);
  },

  /** Admin: reject a pending business -> REJECTED (editable + resubmittable). */
  async reject(id: string, dto: RejectBusinessDto) {
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');
    if (business.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestError('Only a business pending verification can be rejected');
    }

    const updated = await businessesRepository.updateById(id, {
      status: 'REJECTED',
      rejectionReason: dto.reason ?? null,
    });
    await notifyOwner(
      String(updated!.ownerId),
      'Business needs changes',
      dto.reason
        ? `${updated!.name} was not approved: ${dto.reason}`
        : `${updated!.name} was not approved. Please review and resubmit.`,
      { businessId: id, status: 'REJECTED' },
    );
    return toPublicBusiness(updated!);
  },

  /** Owner-only hard delete. Cascades to queues, their entries, and staff memberships. */
  async remove(userId: string, role: Role, id: string) {
    await assertBusinessRole(userId, id, 'OWNER', role);
    const business = await businessesRepository.findById(id);
    if (!business) throw new NotFoundError('Business not found');

    await entriesRepository.deleteByBusinessId(id);
    await queuesRepository.deleteByBusinessId(id);
    await membershipsRepository.deleteByBusinessId(id);
    await businessesRepository.deleteById(id);

    return { id };
  },

  async listMine(ownerId: string) {
    const businesses = await businessesRepository.listOwnedBy(ownerId);
    return businesses.map(toPublicBusiness);
  },

  async explore(query: ExploreQuery) {
    const filter: FilterQuery<BusinessDoc> = { status: 'ACTIVE' };
    if (query.category) filter.category = query.category;
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };

    const skip = (query.page - 1) * query.limit;
    const near =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng, maxDistanceMeters: query.radiusKm * 1000 }
        : undefined;

    const { items, total } = await businessesRepository.search({
      filter,
      skip,
      limit: query.limit,
      near,
    });

    return {
      items: items.map(toPublicBusiness),
      page: query.page,
      limit: query.limit,
      total,
    };
  },
};
