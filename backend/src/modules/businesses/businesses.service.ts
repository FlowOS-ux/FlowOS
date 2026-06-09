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
import { NotFoundError } from '../../lib/errors';
import { APPROVED_STATUS, type Role } from '../../types';
import type { CreateBusinessDto, UpdateBusinessDto, ExploreQuery } from './businesses.schema';

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
    approvedAt: b.approvedAt ?? null,
    rejectedAt: b.rejectedAt ?? null,
    ratingAvg: b.ratingAvg,
    ratingCount: b.ratingCount,
    ownerId: String(b.ownerId),
    createdAt: b.createdAt,
  };
}

export const businessesService = {
  async register(ownerId: string, dto: CreateBusinessDto) {
    // New businesses are submitted for admin review immediately — they are not
    // live until an admin approves them.
    const business = await businessesRepository.create({
      name: dto.name,
      category: dto.category,
      description: dto.description,
      address: dto.address,
      phone: dto.phone,
      logoUrl: dto.logoUrl,
      ownerId,
      status: 'PENDING_VERIFICATION',
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
    const filter: FilterQuery<BusinessDoc> = { status: APPROVED_STATUS };
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
