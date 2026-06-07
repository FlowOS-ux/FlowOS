/**
 * FlowOS - src/models/membership.model.ts
 * Staff membership: links a User to a Business with a business-scoped role.
 * Model: StaffMember | Collection: staffMembers
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { MEMBERSHIP_ROLES } from '../types';

const staffMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    role: { type: String, enum: MEMBERSHIP_ROLES, required: true },
    status: { type: String, enum: ['INVITED', 'ACTIVE'], default: 'ACTIVE' },
    invitedEmail: { type: String, lowercase: true, trim: true },
  },
  { timestamps: true },
);

// A user holds at most one membership per business.
staffMemberSchema.index({ userId: 1, businessId: 1 }, { unique: true });

export type StaffMemberDoc = HydratedDocument<InferSchemaType<typeof staffMemberSchema>>;
export const StaffMember = model('StaffMember', staffMemberSchema, 'staffMembers');
