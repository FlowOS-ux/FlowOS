/**
 * FlowOS - src/modules/memberships/memberships.service.ts
 * Staff management: list staff, add a user as staff/manager, change role, remove.
 * The OWNER membership (created on business registration) is immutable here.
 */
import { membershipsRepository } from './memberships.repository';
import { businessesRepository } from '../businesses/businesses.repository';
import { User, type StaffMemberDoc } from '../../models';
import { assertBusinessRole } from '../../lib/businessAccess';
import { notifications } from '../../container';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { Role } from '../../types';
import type { AddStaffDto, UpdateStaffDto } from './memberships.schema';

function toPublic(m: StaffMemberDoc) {
  const u = m.userId as unknown as { id?: string; name?: string; email?: string; avatarUrl?: string };
  return {
    id: m.id as string,
    businessId: String(m.businessId),
    role: m.role,
    status: m.status,
    user:
      u && typeof u === 'object' && 'name' in u
        ? { id: String((u as { _id?: unknown })._id ?? u.id), name: u.name, email: u.email, avatarUrl: u.avatarUrl }
        : null,
    createdAt: m.createdAt,
  };
}

export const membershipsService = {
  async list(actorId: string, role: Role, businessId: string) {
    await assertBusinessRole(actorId, businessId, 'MANAGER', role);
    const staff = await membershipsRepository.listByBusiness(businessId);
    return staff.map(toPublic);
  },

  async add(actorId: string, role: Role, businessId: string, dto: AddStaffDto) {
    await assertBusinessRole(actorId, businessId, 'MANAGER', role);

    const business = await businessesRepository.findById(businessId);
    if (!business) throw new NotFoundError('Business not found');

    const target = await User.findOne({ email: dto.email }).exec();
    if (!target) throw new BadRequestError('No FlowOS user exists with that email');

    const existing = await membershipsRepository.findByUserAndBusiness(target.id, businessId);
    if (existing) throw new ConflictError('This user is already part of the business');

    const membership = await membershipsRepository.create({
      userId: target.id,
      businessId,
      role: dto.role,
      status: 'ACTIVE',
    });

    await notifications.notify(target.id, {
      type: 'STAFF_INVITE',
      title: 'You were added to a team',
      body: `You are now ${dto.role} at ${business.name}.`,
      data: { businessId },
    });

    const populated = await membershipsRepository.findById(membership.id);
    return toPublic(populated ?? membership);
  },

  async updateRole(actorId: string, role: Role, membershipId: string, dto: UpdateStaffDto) {
    const membership = await membershipsRepository.findById(membershipId);
    if (!membership) throw new NotFoundError('Membership not found');
    await assertBusinessRole(actorId, String(membership.businessId), 'OWNER', role);
    if (membership.role === 'OWNER') throw new ForbiddenError('Cannot change the owner role');

    const updated = await membershipsRepository.updateById(membershipId, { role: dto.role });
    return toPublic(updated!);
  },

  async remove(actorId: string, role: Role, membershipId: string) {
    const membership = await membershipsRepository.findById(membershipId);
    if (!membership) throw new NotFoundError('Membership not found');
    await assertBusinessRole(actorId, String(membership.businessId), 'MANAGER', role);
    if (membership.role === 'OWNER') throw new ForbiddenError('Cannot remove the owner');

    await membershipsRepository.deleteById(membershipId);
    return { success: true };
  },
};
