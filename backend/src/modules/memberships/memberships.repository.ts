/**
 * FlowOS - src/modules/memberships/memberships.repository.ts
 * Data-access layer for staff memberships.
 */
import { StaffMember, type StaffMemberDoc } from '../../models';

export const membershipsRepository = {
  create(data: Record<string, unknown>): Promise<StaffMemberDoc> {
    return StaffMember.create(data);
  },

  findById(id: string): Promise<StaffMemberDoc | null> {
    return StaffMember.findById(id).exec();
  },

  findByUserAndBusiness(userId: string, businessId: string): Promise<StaffMemberDoc | null> {
    return StaffMember.findOne({ userId, businessId }).exec();
  },

  listByBusiness(businessId: string): Promise<StaffMemberDoc[]> {
    return StaffMember.find({ businessId })
      .sort({ createdAt: 1 })
      .populate('userId', 'name email avatarUrl')
      .exec();
  },

  updateById(id: string, update: Record<string, unknown>): Promise<StaffMemberDoc | null> {
    return StaffMember.findByIdAndUpdate(id, update, { new: true }).exec();
  },

  deleteById(id: string): Promise<unknown> {
    return StaffMember.deleteOne({ _id: id }).exec();
  },

  deleteByBusinessId(businessId: string): Promise<unknown> {
    return StaffMember.deleteMany({ businessId }).exec();
  },
};
